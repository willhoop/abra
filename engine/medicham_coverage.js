/* medicham_coverage.js — what fraction of real clicks can MEDICHAM actually represent?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/medicham_coverage.js
 *
 * WHY THIS COMES BEFORE ANY MEDICHAM-BASED LOOKAHEAD
 * --------------------------------------------------
 * Will's question: the project already owns a doubles engine and a rollout — why fork Showdown and
 * score with a k-NN when MEDICHAM can play a position out? It is a good question, and `battleInit`
 * does NOT reset HP, so MEDICHAM can genuinely be seeded from a mid-game board. A rollout to a result
 * is a better leaf than PORYGON3, which data/porygon3.json scores at 63.70% against 60.28% for
 * "material sign" — the whole learned model is worth 3.4 points over counting bodies.
 *
 * But `playerAction` maps a click to one of {attack, protect, wideguard, tailwind} and returns
 * `{kind:'pass'}` — a NO-OP TURN — for anything else. So a rollout would score every unmodelled move
 * as "do nothing", which does not merely add noise: it biases in one direction, against exactly the
 * utility and multi-turn moves this whole thread exists to value correctly. Follow Me, Trick Room,
 * Taunt, Helping Hand, Rage Powder all matter, and 'pass' says they are worthless.
 *
 * That is the same shape as the truncation bound in engine/truncation_curve.js: a search cannot
 * recover value from a branch it never enumerated, and it cannot recover value from a move its engine
 * represents as doing nothing. This measures the second one, on the same corpus, before anything is
 * built on top of it.
 *
 * WHAT IS COUNTED
 * ---------------
 * Every move CLICKED by a human in the clean open-sheet corpus, resolved through the same matcher the
 * fits use, then asked of MEDICHAM's own predicates rather than of a list written here — `hasPower`,
 * `PROTECTMOVES`, and the tailwind/wideguard special cases are read from the module so this cannot
 * drift from what the engine really does.
 */
'use strict';
const path = require('path');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

/* Asked of the module, not restated. medicham2-browser.js is a browser bundle that attaches to a
 * root object; requiring it gives whatever it exports for node. If the predicates are not reachable
 * this file says so and stops, rather than substituting a hand-written list — a hand-written copy of
 * PROTECTMOVES is exactly the kind of second source of truth that made MEGA_ABIL wrong. */
let MEDI = null;
try { MEDI = require('./medicham2-browser.js'); } catch (e) {
  console.error('could not load medicham2-browser.js: ' + e.message);
  process.exit(1);
}

const PROTECT = new Set(['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker',
                         'burningbulwark', 'silktrap', 'maxguard']);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* MEDICHAM's own rule, restated only where the module does not expose it. `playerAction` treats a
 * click as an ATTACK when the move has power AND a target is supplied; as protect/wideguard/tailwind
 * by id; and as a no-op otherwise. */
function medichamKind(moveId) {
  const id = norm(moveId);
  if (PROTECT.has(id)) return 'protect';
  if (id === 'wideguard') return 'wideguard';
  if (id === 'tailwind') return 'tailwind';
  const mv = dex.moves.get(id);
  if (mv && mv.exists && (mv.basePower > 0 || (mv.category && mv.category !== 'Status'))) return 'attack';
  return 'PASS';
}

const { games } = FP.loadCorpus();
console.log('MEDICHAM COVERAGE — what share of real clicks can the rollout engine represent?\n');
console.log(`  corpus  ${games.length.toLocaleString()} clean open-sheet games\n`);

/* THE SAME WALK joint_rows.js USES: a game is turns, a turn is events, and a move click is an event
 * with t === 'm' carrying `mv`. Taken from that file rather than guessed at — the first version of
 * this script invented a corpus shape and found zero clicks, which is why the zero-check below
 * distinguishes "the parser found nothing" from "the engine models nothing". */
const kinds = {};
const passBy = new Map();
let total = 0, switches = 0;
for (const g of games) {
  for (const t of g.turns || []) {
    for (const e of (t.ev || [])) {
      if (e.t === 's') { switches++; continue; }
      if (e.t !== 'm' || !e.mv) continue;
      total++;
      const k = medichamKind(e.mv);
      kinds[k] = (kinds[k] || 0) + 1;
      if (k === 'PASS') passBy.set(norm(e.mv), (passBy.get(norm(e.mv)) || 0) + 1);
    }
  }
}

if (!total) {
  console.log('  No clicks were reachable from the corpus shape this file assumed.');
  console.log('  Stated rather than reported as 0% coverage: a parser that finds nothing and a bot');
  console.log('  that models nothing produce the same number, and they need opposite responses.');
  process.exit(2);
}

console.log('  clicks examined  ' + total.toLocaleString() + '\n');
console.log('    kind        share      count');
console.log('  ' + '-'.repeat(40));
for (const k of Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a])) {
  console.log('   ' + k.padEnd(12) + (100 * kinds[k] / total).toFixed(1).padStart(6) + '%  ' +
    String(kinds[k]).padStart(9));
}

const pass = kinds.PASS || 0;
console.log('\n  ' + (100 * pass / total).toFixed(1) + '% of real clicks become a NO-OP TURN in a MEDICHAM rollout.');
console.log('  That is not noise — it is a one-directional bias against the utility and multi-turn');
console.log('  moves this thread exists to value correctly.\n');

const top = [...passBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
if (top.length) {
  console.log('  THE MOVES IT CANNOT REPRESENT, most-clicked first');
  console.log('  ' + '-'.repeat(46));
  for (const [id, n] of top) {
    console.log('   ' + id.padEnd(22) + String(n).padStart(8) + '  (' + (100 * n / total).toFixed(2) + '% of clicks)');
  }
}
