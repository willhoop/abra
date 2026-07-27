/* h2h_stats.js — cut a head-to-head run every way that could hide or fake an effect.
 *
 *   node engine/h2h_stats.js data/h2h-farm-20k.jsonl
 *
 * WHY MORE THAN ONE NUMBER
 * ------------------------
 * A single win rate can be right and useless. This run already produced three different answers to
 * the same question depending on how it was read — 48.3% unpaired and closed-sheet, 51.7% raw, 55.5%
 * on decisive pairs — and only the last one is the designed readout. So rather than defend one
 * figure, this prints the cuts that would EXPOSE a wrong one:
 *
 *   side balance      p1 must not beat p2. If it does, the harness is biased and every other number
 *                     inherits it. This project has measured a real 0.86-point side bias before.
 *   game length       a bot that wins by stalling is not a better bot. Split by turns.
 *   who leads         does the edge come from the opening or from the endgame?
 *   sweep vs grind    winning 4-0 is a different claim from winning 4-3.
 *   by team           an edge concentrated in a handful of teams is a matchup artifact, not skill.
 *   first blood       does the new model win because it gets the first kill, or despite not?
 *
 * Anything that only shows up in one cut is probably not real.
 */
'use strict';
const fs = require('fs');
const readline = require('readline');

const file = process.argv[2] || 'data/h2h-farm-20k.jsonl';
const NEW = 'score';

const games = [];
(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let g; try { g = JSON.parse(line); } catch (e) { continue; }
    if (!g.selfplay || !g.selfplay.winnerPolicy) continue;
    games.push(g);
  }
  report();
})();

const wil = (k, n) => {
  if (!n) return '   n/a';
  const p = k / n, z = 1.959964, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return `${(100 * p).toFixed(1)}% [${(100 * (c - h)).toFixed(1)}, ${(100 * (c + h)).toFixed(1)}]`;
};

function report() {
  console.log(`HEAD-TO-HEAD, EVERY WAY IT CAN BE CUT — ${games.length.toLocaleString()} games\n`);

  /* ---- 1. the harness itself -------------------------------------------------------------- */
  let p1w = 0, decided = 0;
  for (const g of games) {
    if (!g.winner || !g.p1) continue;
    decided++; if (g.winner === g.p1.name) p1w++;
  }
  console.log('1. IS THE HARNESS FAIR? p1 should win half. A bias here poisons everything else.');
  console.log(`   p1 win rate  ${wil(p1w, decided)}   over ${decided.toLocaleString()} decided games`);
  const fair = Math.abs(p1w / decided - 0.5) < 0.02;
  console.log(`   ${fair ? 'within 2 points of even — usable' : 'OFF CENTRE — treat every number below with suspicion'}\n`);

  /* ---- pair up ------------------------------------------------------------------------------ */
  const bySeed = new Map();
  for (const g of games) {
    const k = String(g.selfplay.seed);
    if (!bySeed.has(k)) bySeed.set(k, []);
    bySeed.get(k).push(g);
  }
  const pairs = [];
  for (const [k, gs] of bySeed) {
    if (gs.length !== 2) continue;
    if (gs[0].selfplay.swapped === gs[1].selfplay.swapped) continue;
    const w = gs.map(g => (g.selfplay.winnerPolicy === NEW ? 1 : 0));
    pairs.push({ k, gs, score: w[0] + w[1], turns: gs.map(g => (g.turns || []).length) });
  }

  const cut = (label, keep) => {
    const sub = pairs.filter(keep);
    const dec = sub.filter(p => p.score !== 1);
    const won = dec.filter(p => p.score === 2).length;
    console.log(`   ${label.padEnd(30)} ${String(sub.length).padStart(6)} pairs  ${String(dec.length).padStart(5)} decisive   ${wil(won, dec.length)}`);
  };

  console.log('2. BY GAME LENGTH — a bot that only wins long games is winning by attrition.');
  cut('both games under 8 turns', p => Math.max(...p.turns) < 8);
  cut('both 8-12 turns (typical)', p => Math.min(...p.turns) >= 8 && Math.max(...p.turns) <= 12);
  cut('either over 12 turns', p => Math.max(...p.turns) > 12);
  cut('either over 20 turns', p => Math.max(...p.turns) > 20);

  console.log('\n3. BY MARGIN — how many Pokemon the winner had left. A sweep is a different claim.');
  const survivors = g => {
    const dead = new Set();
    for (const t of g.turns || []) for (const e of t.ev || []) if (e.t === 'f' && e.s) dead.add(e.s.slice(0, 2) + ':' + e.mon);
    const wSide = g.winner === (g.p1 && g.p1.name) ? 'p1' : 'p2';
    const brought = ((g.brought || {})[wSide] || []).length || 4;
    let lost = 0; for (const d of dead) if (d.startsWith(wSide + ':')) lost++;
    return Math.max(0, brought - lost);
  };
  const marginOf = p => Math.min(...p.gs.map(survivors));
  cut('winner kept 3-4 (a sweep)', p => marginOf(p) >= 3);
  cut('winner kept 2', p => marginOf(p) === 2);
  cut('winner kept 0-1 (a grind)', p => marginOf(p) <= 1);

  console.log('\n4. BY FIRST BLOOD — does the edge come from getting the first kill, or surviving it?');
  const firstKillIsNew = g => {
    for (const t of g.turns || []) for (const e of t.ev || []) {
      if (e.t !== 'f' || !e.s) continue;
      /* the side that LOST a Pokemon first; the other side drew first blood */
      const loser = e.s.slice(0, 2);
      const newIsP1 = !g.selfplay.swapped;
      const newSide = newIsP1 ? 'p1' : 'p2';
      return loser !== newSide;
    }
    return null;
  };
  cut('NEW drew first blood in both', p => p.gs.every(g => firstKillIsNew(g) === true));
  cut('OLD drew first blood in both', p => p.gs.every(g => firstKillIsNew(g) === false));

  console.log('\n5. BY TEAM — an edge living in a few teams is a matchup artifact, not a better player.');
  const teamKey = g => (g.six && g.six.p1 || []).slice().sort().join(',');
  const byTeam = new Map();
  for (const p of pairs) {
    if (p.score === 1) continue;
    const k = teamKey(p.gs[0]);
    if (!byTeam.has(k)) byTeam.set(k, { w: 0, n: 0 });
    const e = byTeam.get(k); e.n++; if (p.score === 2) e.w++;
  }
  const teams = [...byTeam.values()].filter(e => e.n >= 3);
  const newAhead = teams.filter(e => e.w / e.n > 0.5).length;
  const oldAhead = teams.filter(e => e.w / e.n < 0.5).length;
  console.log(`   teams with 3+ decisive pairs: ${teams.length}`);
  console.log(`   NEW ahead on ${newAhead}, OLD ahead on ${oldAhead}, level on ${teams.length - newAhead - oldAhead}`);
  console.log(`   ${newAhead > oldAhead * 1.15 ? 'the edge is spread across teams, not concentrated' : 'NOT clearly spread — could be a matchup artifact'}`);

  /* ---- 6. behaviour, not outcome ------------------------------------------------------------ */
  console.log('\n6. HOW THEY PLAY — same run, per policy, over every decision made.');
  const st = { [NEW]: mk(), old: mk() };
  function mk() { return { moves: 0, switches: 0, protects: 0, ko: 0, miss: 0, immune: 0, fail: 0, games: 0, turns: 0 }; }
  for (const g of games) {
    const newSide = g.selfplay.swapped ? 'p2' : 'p1';
    for (const key of [NEW, 'old']) st[key].games++;
    for (const t of g.turns || []) {
      for (const e of t.ev || []) {
        if (!e.s) continue;
        const s = st[e.s.slice(0, 2) === newSide ? NEW : 'old'];
        if (e.t === 'm') {
          s.moves++;
          if (/protect|detect|bunker|shield|endure/i.test(e.mv || '')) s.protects++;
          if (e.ko) s.ko++;
          if (e.miss) s.miss++;
          if (e.immune) s.immune++;
          if (e.fail) s.fail++;
        } else if (e.t === 's') s.switches++;
      }
    }
  }
  const row = (label, f) => console.log(`   ${label.padEnd(28)} NEW ${String(f(st[NEW])).padStart(8)}     OLD ${String(f(st.old)).padStart(8)}`);
  const pc2 = (a, b) => (100 * a / Math.max(1, b)).toFixed(2) + '%';
  row('moves made', s => s.moves.toLocaleString());
  row('protect-family share', s => pc2(s.protects, s.moves));
  row('moves that got a KO', s => pc2(s.ko, s.moves));
  row('moves that MISSED', s => pc2(s.miss, s.moves));
  row('moves that hit an immunity', s => pc2(s.immune, s.moves));
  row('moves that FAILED', s => pc2(s.fail, s.moves));
  row('switches per game', s => (s.switches / Math.max(1, s.games)).toFixed(2));

  console.log(`
  READ 1 FIRST. If p1 is not near 50% nothing else is interpretable. Then look for the edge to
  appear in MOST cuts — an effect that lives in one slice and vanishes in the others is the slice,
  not the model.`);
}
