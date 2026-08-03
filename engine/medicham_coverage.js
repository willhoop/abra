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
try {
  /* Sets globalThis.MC and mcEff, which medicham2-browser.js expects to be in scope — it is a browser
   * bundle and the page normally provides them. Same line engine/backtest_winrate.js uses, and it
   * must come FIRST or buildMon throws on `MC.mons`. */
  require('../data/engine-data.js');
  MEDI = require('./medicham2-browser.js');
} catch (e) {
  console.error('could not load medicham2-browser.js: ' + e.message);
  process.exit(1);
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ASK playerAction, DO NOT IMITATE IT. The first version of this file restated what it believed
 * playerAction's rules were — protect / wideguard / tailwind / attack / else no-op — and reported
 * 15.3% unmodelled. That was wrong, and wrong in the way this file's own header warns about: the
 * real function ALSO emits `status` for anything with a major-status effect (Will-O-Wisp, Toxic,
 * Sleep Powder, Hypnosis), `setup` for self-boosting moves (Nasty Plot, Calm Mind, Swords Dance,
 * Coil, Bulk Up), and routes Encore through the status path on a `sealsMoves` tag. A hand-written
 * copy of a predicate is a second source of truth, and it disagreed with the first one immediately.
 *
 * Two live mons are built so the ATTACK branch can be reached at all — it requires `hasPower(mv)`
 * AND a target, so passing no target would misreport every damaging move as unmodelled. Which two
 * species they are does not matter: no branch of playerAction depends on the matchup, only on the
 * move. Verified rather than assumed by the self-check below. */
let MEDI_ME = null, MEDI_TGT = null;
for (const n of Object.keys(globalThis.MC.mons)) {
  const m = MEDI.buildMon(n, {});
  if (!m) continue;
  if (!MEDI_ME) MEDI_ME = m;
  else { MEDI_TGT = m; break; }
}
if (!MEDI_ME || !MEDI_TGT) {
  console.error('could not build two reference mons from MEDICHAM — cannot ask playerAction anything.');
  process.exit(1);
}
const FIELD = { terrain: '', weather: '', twA: 0, twB: 0, tr: 0 };

function medichamKind(moveId) {
  const a = MEDI.playerAction(MEDI_ME, norm(moveId), MEDI_TGT, FIELD);
  const k = (a && a.kind) || 'pass';
  return k === 'pass' ? 'PASS' : k;
}

/* SELF-CHECK, because a harness that silently returns PASS for everything and an engine that models
 * nothing produce the same table. Four moves with four different known kinds. */
for (const [id, want] of [['flamethrower', 'attack'], ['protect', 'protect'],
                          ['tailwind', 'tail'], ['willowisp', 'status']]) {
  const got = medichamKind(id);
  if (got !== want) {
    console.error(`self-check FAILED: ${id} -> ${got}, expected ${want}. ` +
      'playerAction is not being reached as this file assumes; the coverage below would be fiction.');
    process.exit(1);
  }
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

/* THE CUMULATIVE CURVE, because "add some moves" is not a plan and "add these nine" is. Coverage
 * climbs as each unmodelled move is implemented, so the question "how many moves to reach 97%" has
 * an exact answer and it is read off here rather than estimated. The long tail is the point: the
 * distribution is steep, so most of the gap is a short list and the rest is hundreds of singletons
 * that will never be worth implementing. */
const ranked = [...passBy.entries()].sort((a, b) => b[1] - a[1]);
const covered = total - pass;
console.log('  THE MOVES IT CANNOT REPRESENT, and what implementing them buys');
console.log('  ' + '-'.repeat(64));
console.log('    #  move                     clicks   share   coverage after');
let run = 0;
const marks = {};
for (let i = 0; i < ranked.length; i++) {
  const [id, n] = ranked[i];
  run += n;
  const cov = 100 * (covered + run) / total;
  for (const t of [90, 95, 97, 98, 99]) if (!marks[t] && cov >= t) marks[t] = i + 1;
  if (i < 24) {
    console.log('   ' + String(i + 1).padStart(2) + '  ' + id.padEnd(22) +
      String(n).padStart(8) + '  ' + (100 * n / total).toFixed(2).padStart(5) + '%  ' +
      cov.toFixed(2).padStart(9) + '%');
  }
}
console.log(`   ... ${ranked.length} distinct unmodelled moves in total`);
console.log('\n  MOVES NEEDED TO REACH');
console.log('  ' + '-'.repeat(40));
for (const t of [90, 95, 97, 98, 99]) {
  console.log('   ' + String(t).padStart(3) + '%  ' +
    (marks[t] ? `implement the top ${marks[t]}` : 'not reachable — the tail is too long'));
}
