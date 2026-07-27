/* paired_h2h.js — read a paired head-to-head run by PAIR, not by game.
 *
 *   node engine/paired_h2h.js data/games.h2h-ots.jsonl
 *
 * WHY PAIRS AND NOT GAMES
 * -----------------------
 * In a paired run the same matchup is played twice on the same seed, once with each policy on each
 * side. That means three outcomes per pair, and only two of them carry information:
 *
 *   2-0   the same policy won BOTH directions. It won with the worse team as well as the better one,
 *         so the teams cannot explain it. This is signal.
 *   1-1   each policy won its own side. The team decided the game, not the policy. This is NOISE,
 *         and counting it as "one win each" dilutes the comparison rather than informing it.
 *   0-2   the other policy did the same thing.
 *
 * Reading a paired run as a raw win rate over all games throws away the pairing it was built for.
 * It also OVERSTATES the sample: a pair is one observation, not two, so the interval belongs on the
 * number of pairs.
 *
 * THE TEST. Discarding ties and asking whether 2-0 outnumbers 0-2 is exactly McNemar's test, which
 * is the standard treatment for paired binary outcomes. The interval below is the Wilson interval on
 * the DECISIVE pairs alone, which is the honest denominator: it says how confident we are that a
 * decisive pair goes the new model's way, and it says nothing about the ties because the ties say
 * nothing about the policies.
 *
 * If the decisive pairs are a small share of the total, that is itself the finding: it means the
 * teams, not the policies, are deciding these games.
 */
'use strict';
const fs = require('fs');

const file = process.argv[2] || 'data/games.h2h-ots.jsonl';
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => {
  try { return JSON.parse(l); } catch (e) { return null; }
}).filter(g => g && g.selfplay && g.selfplay.winnerPolicy);

/* A pair is one seed. Anything that did not come back as an exact two is dropped and counted --
 * a half-pair cannot be read either way, and silently keeping it would reintroduce the team bias
 * the design exists to remove. */
const bySeed = new Map();
for (const g of rows) {
  const k = String(g.selfplay.seed);
  if (!bySeed.has(k)) bySeed.set(k, []);
  bySeed.get(k).push(g);
}

const NEW = 'score';
let both = 0, split = 0, neither = 0, halves = 0, mismatchedTeams = 0;
let rawNew = 0, rawOld = 0;
for (const [, gs] of bySeed) {
  if (gs.length !== 2) { halves += gs.length; continue; }
  /* Both halves must genuinely be the same matchup, or the pairing is a fiction. */
  const six = g => JSON.stringify((g.six && g.six.p1 || []).slice().sort()) +
                   JSON.stringify((g.six && g.six.p2 || []).slice().sort());
  if (six(gs[0]) !== six(gs[1])) { mismatchedTeams++; continue; }
  if (gs[0].selfplay.swapped === gs[1].selfplay.swapped) { mismatchedTeams++; continue; }
  const w = gs.map(g => g.selfplay.winnerPolicy === NEW ? 1 : 0);
  rawNew += w[0] + w[1]; rawOld += 2 - w[0] - w[1];
  const s = w[0] + w[1];
  if (s === 2) both++; else if (s === 1) split++; else neither++;
}

const pairs = both + split + neither;
const decisive = both + neither;
const p = decisive ? both / decisive : 0;
const z = 1.959964, n = Math.max(1, decisive);
const d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d;
const hw = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
/* WHAT ACTUALLY PLAYED WHAT, IN WORDS.
 *
 * Three runs tonight were identified only by filename — h2h-monkey, h2h-monkey2, h2h-cell3 — and two
 * of them differed in a way that changes the meaning of every number in the report: whether the
 * random opponent could switch at all. A win rate against a monkey that never switches is not
 * comparable to one against a monkey that does, and nothing in the output said which was which.
 *
 * Read off the record rather than typed, so a report cannot describe a run it did not come from. */
function describe(g) {
  const sp = (g && g.selfplay) || {};
  const name = (pol) => {
    if (pol === 'score') {
      const rule = sp.greedy ? 'takes its BEST-scoring option every time'
                             : 'takes a WEIGHTED ROLL over its scores, not the best';
      const sw = sp.switching ? ', switching ON' : ', switching off';
      return `MAG — ${rule}${sw}`;
    }
    if (pol === 'prior') return 'behaviour clone — clicks what people click, blind to the board';
    if (pol === 'random') {
      /* ABSENT IS NOT THE SAME AS ZERO, and absent now means genuinely absent.
       *
       * engine/mew.js used to write `randmove` only when it differed from its default of 1, so a run
       * using the default looked identical to a run made before the flag existed. This message duly
       * fired on runs created minutes earlier — three times on 2026-07-27 — and read as though the data
       * were old rather than the record being incomplete. mew.js now stamps the setting unconditionally,
       * so silence here really does mean a record written before that change. */
      if (sp.randmove == null) return 'pure random — switch setting not recorded (record predates 3.26.0)';
      return sp.randmove < 1
        ? `pure random — switches about ${Math.round(100 * (1 - sp.randmove))}% of the time`
        : 'pure random — MOVES ONLY, never switches by choice';
    }
    if (String(pol).startsWith('score@')) return 'MAG from another checkout: ' + String(pol).slice(6);
    return String(pol || '?');
  };
  return {
    a: name(sp.policy),
    b: name(sp.policy2 || sp.policy),
    fmt: /bo3/.test(String(sp.format || '')) ? 'open team sheets (forced)' : 'closed team sheets',
  };
}
console.log(`PAIRED HEAD-TO-HEAD — ${file}\n`);
if (rows.length) {
  const d = describe(rows[0]);
  console.log(`  NEW  =  ${d.a}`);
  console.log(`  OLD  =  ${d.b}`);
  console.log(`  format  ${d.fmt}\n`);
}
console.log(`  complete pairs        ${pairs.toLocaleString()}`);
if (halves) console.log(`  dropped, half a pair  ${halves.toLocaleString()}`);
if (mismatchedTeams) console.log(`  dropped, not a true pair ${mismatchedTeams.toLocaleString()}`);
console.log(`\n  NEW won both directions   ${String(both).padStart(6)}   ${pct(both, pairs)}`);
console.log(`  split, one each           ${String(split).padStart(6)}   ${pct(split, pairs)}   <- the team decided it, not the bots`);
console.log(`  OLD won both directions   ${String(neither).padStart(6)}   ${pct(neither, pairs)}`);

console.log(`\n  DECISIVE PAIRS: ${decisive.toLocaleString()} (${pct(decisive, pairs)} of all pairs)`);
console.log(`  of those, NEW took ${(100 * p).toFixed(1)}%   95% CI [${(100 * (c - hw)).toFixed(1)}, ${(100 * (c + hw)).toFixed(1)}]`);
console.log(`\n  (raw game count, for comparison only: NEW ${rawNew} / OLD ${rawOld} — ` +
            `this is the number the pairing exists to improve on)`);

if (c - hw > 0.5) console.log('\n  -> the new model is better, and the interval clears 50%.');
else if (c + hw < 0.5) console.log('\n  -> the new model is WORSE, and the interval clears 50%.');
else console.log(`\n  -> cannot be told apart from a coin. At ${decisive.toLocaleString()} decisive pairs this can ` +
                 `resolve an edge of about ${(100 * hw).toFixed(1)} points; anything smaller is invisible here.`);
