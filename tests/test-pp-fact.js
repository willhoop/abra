/* test-pp-fact.js — THE TWO PP IMPLEMENTATIONS MUST AGREE, AND ONE OF THEM IS NOT IMPORTABLE
 *
 * ROADMAP #144 gave `engine/medicham2-browser.js` PP as five FILE-LOCAL functions. ROADMAP #145
 * needed `engine/board.js` to seed a rollout with the PP the real game has spent, and board.js
 * cannot call file-local functions — so `engine/pp.js` exists, and until ENGINE adopts it (#146)
 * this project has TWO readers of the same fact. CLAUDE.md is unambiguous about what that costs:
 * *"Two files that both decide Choice Scarf multiplies Speed by 1.5 will disagree eventually, and
 * the disagreement will be invisible because both keep working."*
 *
 * THIS FILE IS WHAT MAKES IT VISIBLE. It does not compare source; it compares BEHAVIOUR, because the
 * simulator's copy cannot be called directly. A body is built, a real turn is played, and the number
 * MEDICHAM wrote into its own `_pp` field is checked against the number `pp.js` would have given.
 * A comparison of two implementations by reading one of them proves nothing (LESSONS §4).
 *
 *   node tests/test-pp-fact.js
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const B = require(D('engine', 'board.js'));
const RL = require(D('engine', 'rollout_leaf.js'));
const PP = require(D('engine', 'pp.js'));
const TAGS = require(D('engine', 'tags.js'));
const PROBE = require(D('engine', 'pp_board_probe.js'));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); } };

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ONE REAL CLICK OF `mv`, and read back what the ENGINE thinks is left. The body carries exactly one
 * move so the uniform explore draw cannot pick anything else, and one turn is played through
 * rollout_leaf's own playout rather than a hand-rolled loop. */
function engineLeftAfterOneClick(mv) {
  const bd = new B.Board();
  bd.setParty('p1', ['incineroar']); bd.setParty('p2', ['garchomp']);
  bd.setSheet('p1', 'incineroar', { nature: 'Adamant', item: '', ability: '', moves: [mv] });
  bd.setSheet('p2', 'garchomp', { nature: 'Jolly', item: '', ability: '', moves: ['protect'] });
  bd.switchIn('p1', 'a', 'incineroar'); bd.switchIn('p2', 'a', 'garchomp');
  const st = { fainted: 0, unbuildable: 0, threw: 0 };
  const A = RL.buildSide(bd, 'p1', undefined, st), Bt = RL.buildSide(bd, 'p2', undefined, st);
  if (!A.length || !Bt.length) return null;
  const S = MEDI.battleInit(A, Bt, { seeded: true });
  S.maxTurns = 1;
  RL.applyField(S, {}, 'p1', true);
  RL.runPlayout(S, rngFrom(7), 1.0, 'uniform', { threw: 0, first: null });
  const t = A[0] && A[0][PP.BODY_FIELD];
  return t && Object.prototype.hasOwnProperty.call(t, PP.key(mv)) ? t[PP.key(mv)] : null;
}

console.log('\nPP AS ONE FACT — engine/pp.js against engine/medicham2-browser.js\n');

console.log('1. the MAXIMUM, per tier, checked through a real turn rather than through the artifact');
/* One representative move per distinct maximum this format produces, chosen from the artifact rather
 * than typed, so a mod change that adds a tier is not silently untested. */
const byMax = new Map();
for (const id of TAGS.withTag('move', 'pp')) {
  if (!MC.moves[id]) continue;                  // must be buildable by this engine
  /* STRUGGLE IS EXCLUDED, and not as a convenience: Showdown exempts it from deduction outright
   * (`move.id !== 'struggle'`, sim/battle-actions.ts:282), so it is the one move that can never
   * spend a PP and therefore the one move this arm cannot ask about. */
  if (id === 'struggle') continue;
  const m = PP.maxPP(id);
  if (m == null) continue;
  if (!byMax.has(m)) byMax.set(m, []);
  if (byMax.get(m).length < 3) byMax.get(m).push(id);
}
const tiers = [...byMax.keys()].sort((a, b) => a - b);
ok(tiers.length >= 3, 'the format produces several distinct maxima', 'tiers: ' + tiers.join(', '));
for (const t of tiers) {
  /* The first candidate that the engine will actually spend a PP on. A move the playout cannot
   * represent leaves `_pp` untouched, which is a null rather than a disagreement. */
  let checked = null;
  for (const mv of byMax.get(t)) {
    const left = engineLeftAfterOneClick(mv);
    if (left != null) { checked = { mv, left }; break; }
  }
  if (!checked) { ok(false, `maxpp ${t}: no representative move could be clicked`, byMax.get(t).join(', ')); continue; }
  ok(checked.left === t - 1,
     `maxpp ${t}: the engine's own _pp after one click is max-1`,
     `${checked.mv}: engine says ${checked.left}, pp.js says ${PP.maxPP(checked.mv) - 1}`);
}

console.log('\n2. the CHAMPIONS numbers, and the mainline rule they are not');
/* `floor(base * 0.8) + 4` is stated in Will's brief and in medicham2's header. It is checked here
 * and is NOT the implementation anywhere: the moment the mod changes the rule, this assertion turns
 * red and the engine keeps working, which is the correct direction for a formula nobody reads. */
let fits = 0, rows = 0, mainlineFits = 0, boostable = 0, exempt = [];
for (const id of TAGS.withTag('move', 'pp')) {
  const p = TAGS.param('move', id, 'pp');
  if (!p || !(+p.max > 0) || !(+p.base > 0)) continue;
  rows++;
  if (+p.max === Math.floor(+p.base * 8 / 5)) mainlineFits++;
  /* THE FORMULA IS THE MAX-PP RULE, so it can only apply to a move that TAKES PP boosts. Champions
   * max-PPs everything; a move flagged `noPPBoosts` keeps its base and is the one row the formula
   * must NOT fit. Partitioned on the artifact's own flag rather than on a name, so a second such
   * move arriving tomorrow lands on the right side of this without an edit. */
  if (p.noPPBoosts) { if (+p.max === +p.base) exempt.push(id); continue; }
  boostable++;
  if (+p.max === Math.floor(+p.base * 0.8) + 4) fits++;
}
ok(rows >= 400, 'the artifact carries a pp row for the whole format', rows + ' moves');
ok(fits === boostable, 'floor(base*0.8)+4 fits every PP-BOOSTABLE row', fits + '/' + boostable);
/* MEASURED CORRECTION, 2026-08-11. `docs/_outbox/pp-and-moldbreaker-notes.md` reports the formula
 * fitting "500 of 500". It fits 499: Struggle is `noPPBoosts` and stays at 1/1, where the formula
 * would give 4. Nothing downstream is wrong — the number is READ, never computed — but the claim as
 * written would have to break before the artifact did. */
ok(exempt.length === rows - boostable && exempt.length >= 1,
   'and every `noPPBoosts` row keeps its base instead — the formula fits 499 of 500, not 500 of 500',
   'exempt: ' + exempt.join(', '));
ok(mainlineFits < rows, 'and the MAINLINE rule does not — a typed table would be wrong on most moves',
   'mainline pp*8/5 fits only ' + mainlineFits + '/' + rows);
ok(PP.maxPP('protect') === 8, 'Protect is 8 here, not the 16 it is in mainline');

console.log('\n3. the RULES, which is where two implementations really part');
const t1 = {};
ok(PP.left(t1, 'protect') === 8, 'an untouched slot reads FULL, not zero — the table is sparse');
ok(PP.spend(t1, 'protect', 1) === 1 && t1.protect === 7, 'one click takes one');
ok(PP.spend(t1, 'protect', 99) === 7 && t1.protect === 0,
   'the clamp returns what was ACTUALLY taken, which is what Spite branches on', '7 of 99');
ok(PP.spend(t1, 'protect', 1) === 0, 'an empty slot yields nothing rather than going negative');
ok(PP.maxPP('thismoveisnotreal') === null && PP.ppFails.unknownMove > 0,
   'a move with no row answers null AND counts itself', JSON.stringify(PP.ppFails.unknownMove));
ok(PP.left({}, 'thismoveisnotreal') === null, 'unknown is not the same value as empty');
ok(PP.allOut(['protect'], { protect: 0 }) === true, 'allOut: every known slot at zero');
ok(PP.allOut(['protect', 'thismoveisnotreal'], { protect: 0 }) === false,
   'allOut: an UNKNOWN move refuses to Struggle a body — unknown must never read as empty');
ok(PP.allOut([], {}) === false, 'allOut: a body with no moves is not Struggling, it is unbuilt');

console.log('\n4. SELECTABILITY is its own question, with PP as one input');
ok(PP.slotSelectable({ ppLeft: 3 }) === true, 'a slot with PP is selectable');
ok(PP.slotSelectable({ ppLeft: 0 }) === false, 'an empty slot is not');
ok(PP.slotSelectable({ ppLeft: null }) === true, 'an unknown slot is selectable — unknown is not empty');
ok(PP.slotSelectable({ ppLeft: 3, disabled: true }) === true,
   'Disable is NAMED in the signature and NOT yet read — our simulator\'s predicate is PP-only and ' +
   'widening it is ENGINE\'s open item. This assertion is the receipt that the gap is deliberate.');

console.log('\n5. PRESSURE — per apparent target, so a self-targeting move pays nothing extra');
ok(PP.extraPerTarget('pressure') === 1, 'Pressure charges 1 extra per apparent target');
ok(PP.extraPerTarget('levitate') === 0, 'and an ordinary ability charges nothing');
ok(PP.alliesExempt('pressure') === true, 'an ALLY is exempt, read from the tag rather than assumed');

console.log('\n6. THE INTEGRATION — a board rollout cannot spend PP the position has already spent');
const before = JSON.parse(JSON.stringify(B.ppCounters));
for (const k of [0, 5, PROBE.MAXPP]) {
  const r = PROBE.runOne(PROBE.makeBoard(k), 90210 + k);
  ok(k + r.protects <= PROBE.MAXPP,
     `${k} Protects already spent -> the rollout adds at most ${PROBE.MAXPP - k}`,
     `added ${r.protects}, total ${k + r.protects} of ${PROBE.MAXPP}`);
  if (k === PROBE.MAXPP) {
    ok(r.protects === 0 && r.struggles > 0,
       'a drained body STRUGGLES from a board position rather than clicking an empty slot',
       `${r.struggles} Struggle(s), ${r.nopp} |cant|nopp`);
    ok(r.nopp === 0,
       'and the explore pick no longer offers the empty slot at all — |cant|nopp is 0',
       'was 52 before the pick was filtered');
  }
}
ok(B.ppCounters.seeded > before.seeded, 'dmgMon really seeded a body — the wire is not inert',
   `seeded ${B.ppCounters.seeded - before.seeded} slot(s)`);
ok(B.ppCounters.moduleMissing === 0, 'and pp.js was reachable from board.js', 'moduleMissing=0');

console.log(`\nPP FACT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
