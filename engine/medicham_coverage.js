/* medicham_coverage.js — what fraction of real clicks can MEDICHAM actually represent?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/medicham_coverage.js
 *
 * WHY THIS COMES BEFORE ANY MEDICHAM-BASED LOOKAHEAD
 * --------------------------------------------------
 * Will's question: the project already owns a doubles engine and a rollout — why fork Showdown and
 * score with a k-NN when MEDICHAM can play a position out? It is a good question, and `battleInit`
 * does NOT reset HP, so MEDICHAM can genuinely be seeded from a mid-game board. A rollout to a result
 * is a better leaf than PORYGON2, which data/porygon2c.json scores at 63.70% against 60.28% for
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
const fs = require('fs');
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
  globalThis.window=globalThis; require('../data/abra-tags.js');
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

/* ---- WHAT THE COVERAGE NUMBER ABOVE IS NOT ------------------------------------------------------
 *
 * It counts a click as covered when it maps to a KIND. It does not check that the engine does
 * everything the move does, and those are different claims. Will asked for exactly this distinction
 * and the honest answer is that this file cannot compute the second one.
 *
 * ATTEMPTED AND WITHDRAWN, recorded so nobody rebuilds it: comparing each move's declared tags
 * against tags whose name or probe appears in medicham2-browser.js reported 43.5% of clicks as
 * partially modelled and "honest fidelity 51.1%". That number is WRONG. Its three largest entries
 * were `stalling` (Protect), `doublesSideSpeed` (Tailwind) and `reversesSpeed` (Trick Room) — all
 * three demonstrably implemented, the last one verified by test the same day. MEDICHAM implements
 * mechanics without ever naming the tag, so name-matching scores working code as missing.
 *
 * Nor can the artifact answer it: `consumedBy` names a board.js FEATURE (`stallingMove`, `speedSide`,
 * `trickRoomField`), so `used:true` means MAG has a feature for it, not that the rollout simulates
 * it. There is no derivable signal here, and a hand-maintained list of "tags MEDICHAM handles" would
 * be exactly the hand-maintained state this project refuses.
 *
 * WHAT CAN BE SAID, because it was checked by reading the engine rather than inferred: MEDICHAM has
 * NO VOLUNTARY SWITCHING. `refill()` replaces a fainted mon and nothing else moves. So every pivot
 * move deals its damage and the user stays, and U-turn / Volt Switch / Flip Turn carry base power,
 * which means they arrive as `attack` and are counted as fully covered above. That share is the one
 * partial-coverage figure in this file that is verified rather than inferred. */
const PIVOTS = Object.keys((globalThis.ABRA_TAGS || {}).moves || {})
  .filter(id => {
    const t = ((globalThis.ABRA_TAGS.moves[id] || {}).tags) || [];
    return t.includes('pivotDamaging') || t.includes('pivotStatus');
  });
let pivotClicks = 0, pivotAsAttack = 0;
for (const g of games) {
  for (const t of g.turns || []) {
    for (const e of (t.ev || [])) {
      if (e.t !== 'm' || !e.mv || !PIVOTS.includes(norm(e.mv))) continue;
      pivotClicks++;
      if (medichamKind(e.mv) === 'attack') pivotAsAttack++;
    }
  }
}
console.log('\n\n  VERIFIED PARTIAL COVERAGE — the switch half of pivot moves');
console.log('  ' + '-'.repeat(66));
console.log('   pivot moves: ' + PIVOTS.join(', '));
console.log('   clicks on them            ' + pivotClicks.toLocaleString() +
  '  (' + (100 * pivotClicks / total).toFixed(2) + '% of all clicks)');
console.log('   of those, counted ABOVE as fully-modelled attacks   ' + pivotAsAttack.toLocaleString() +
  '  (' + (100 * pivotAsAttack / total).toFixed(2) + '%)');
console.log('   MEDICHAM has no voluntary switching, so the user never leaves. The damage is right');
console.log('   and the momentum — the reason the move is played — is missing entirely.');

/* ---- WRITE THE ARTIFACT ------------------------------------------------------------------------
 *
 * THIS FILE PRINTED AND NEVER WROTE, WHICH IS WHY IT HAS NO ARTIFACT. It was on the "three
 * instruments built that have never written an artifact" list (#27) and the reason turned out not to
 * be that nobody ran it — IT STRUCTURALLY COULD NOT PRODUCE ONE. Zero writeFileSync calls. The
 * number reached a terminal and stopped there.
 *
 * WHAT THAT COST, and it is not tidiness. A figure that lives only in stdout cannot be checked by
 * engine/provenance.js, cannot be compared against a later run, cannot be ratcheted, and cannot be
 * cited by a document — tests/test-docs-current.js attributes a figure to the artifact that holds
 * it, so an unwritten number is permanently unciteable. The 15.3% quoted in
 * engine/lookahead_divergence.js has no artifact behind it for exactly this reason, and it is now
 * badly stale: it was measured when playerAction handled FOUR action kinds and it now handles
 * twelve-plus.
 *
 * STAMPED, so the next reader knows what it measured. The engine is the whole subject here, so the
 * digest of medicham2-browser.js is the load-bearing field — a coverage figure is a statement about
 * one specific build of the simulator and transfers to no other. */
const _crypto = require('crypto');
const _sha = (rel) => {
  try { return _crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', rel))).digest('hex').slice(0, 12); }
  catch (e) { return 'UNREADABLE: ' + ((e && e.message) || e); }
};
const OUT = process.argv[2] || path.join(__dirname, '..', 'data', 'medicham-represented-clicks.json');
const art = {
  generated: new Date().toISOString(),
  by: 'engine/medicham_coverage.js',
  what: 'What fraction of REAL HUMAN CLICKS MEDICHAM can represent as an action at all. Anything '
      + 'playerAction does not recognise becomes {kind:"pass"} — a no-op turn — so an unmodelled '
      + 'move is not noise, it is a ONE-DIRECTIONAL bias against exactly the utility and multi-turn '
      + 'moves that decide doubles games.',
  not_what_it_says: 'It counts a click as covered when it maps to a KIND. It does NOT check that the '
      + 'engine then does the right thing with that kind — that is the interaction matrix and the '
      + 'differential test. A move can be counted here and still be wrong.',
  corpus: { games: games.length, clicks: total },
  covered_clicks: covered,
  pass_clicks: pass,
  covered_fraction: +(covered / total).toFixed(6),
  pass_fraction: +(pass / total).toFixed(6),
  by_kind: kinds,
  unmodelled_moves_ranked: ranked.map(([id, n]) => ({ move: id, clicks: n, share: +(n / total).toFixed(6) })),
  distinct_unmodelled: ranked.length,
  moves_needed_to_reach: marks,
  verified_partial_coverage: {
    what: 'The switch half of pivot moves. U-turn and friends carry base power, so they arrive as '
        + '`attack`, are counted as fully covered above, and the momentum — the reason the move is '
        + 'clicked — is not counted at all. This is the one partial-coverage figure here that is '
        + 'verified by reading the engine rather than inferred.',
    correction_2026_08_06: 'THIS ENTRY PREVIOUSLY READ "MEDICHAM has NO voluntary switching" AND '
        + 'THAT IS STALE. The ENGINE gained it: medicham2-browser.js bringIn() is documented as '
        + '"shared by faint replacement and by voluntary/pivot switching" and takes a `wanted` '
        + 'argument so a caller can name WHO comes in, and battleTurn handles kind===\'switch\'. What '
        + 'is true is narrower and lives one level up: THE ROLLOUT never switches. '
        + 'rollout_leaf.js\'s playout picks from mon.moves and has no switch branch at all, so after '
        + 'the stepped turn nobody switches for the rest of the imagined game. The search can offer a '
        + 'switch as a ROOT candidate and then simulates a future in which switching does not exist.',
    what_the_rollout_gap_costs: 'One-directional, like the pass gap. A future with no switching '
        + 'misprices preserving a Pokemon, punishing a switch, and the whole "switch out of a '
        + 'predicted attack" pattern the engine models priority order for. Separately, the LIVE BOT '
        + 'has voluntary switching OFF against a measured 10-point loss (mew.js:135) — three '
        + 'different states (engine capability, rollout behaviour, live setting) that must not be '
        + 'quoted for each other.',
    pivot_moves: PIVOTS,
    clicks: pivotClicks,
    counted_above_as_attack: pivotAsAttack,
    share_of_all_clicks: +(pivotClicks / total).toFixed(6),
  },
  source_digests: {
    'engine/medicham2-browser.js': _sha('engine/medicham2-browser.js'),
    'data/abra-tags.js': _sha('data/abra-tags.js'),
    'data/engine-data.js': _sha('data/engine-data.js'),
    note: 'Content, not mtime. A coverage figure is a statement about ONE BUILD of the simulator and '
        + 'transfers to no other — five WIREs landed on 2026-08-06 alone.',
  },
};
fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
console.log('\n  wrote ' + path.relative(path.join(__dirname, '..'), OUT).replace(/\\/g, '/'));
