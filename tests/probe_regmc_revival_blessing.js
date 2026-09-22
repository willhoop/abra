#!/usr/bin/env node
/* tests/probe_regmc_revival_blessing.js — A MOVE THAT REVIVES A FAINTED ALLY FAILS WITHOUT ONE (REVIVAL BLESSING), UNDER
 * REG M-C. 2026-09-22 (abra/regmc 0.28.0).
 *
 *   node tests/probe_regmc_revival_blessing.js --regulation regmc                               # green, exit 0
 *   MEDI_REVIVE_AS_PIVOT=1 node tests/probe_regmc_revival_blessing.js --regulation regmc        # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts revivalblessing :15110-15136 (the Champions mod names it only in learnsets):
 *       onTryHit(source) { if (!source.side.pokemon.filter(ally => ally.fainted).length) { return false; } },
 *       slotCondition: 'revivalblessing',
 *       // No this not a real switchout move ... This is needed to trigger a switch protocol to choose a fainted party member
 *       selfSwitch: true,
 *   So with NO fainted body in the user's party the move FAILS (`-fail|USER`) and nobody switches. With one, the user's
 *   side answers a switch request naming a FAINTED body, which is revived at half HP (sim/battle.ts:2781-2797,
 *   `sethp(maxhp / 2)` and `-heal ... [from] move: Revival Blessing`); `sim/side.ts:966-968` refuses a live one.
 *   The move is found by its TAG (`revivesFainted`), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   FAIL     the user clicks the move with all four of its bodies standing: `-fail`, and it stays in.
 *   (REVIVE  a fainted ally exists: NOT STAGED. The harness answers the authority's revival request by mirroring this
 *            engine's slot, and its mirror looks only for a LIVE bench body, so the request cannot be expressed. Filed.)
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_revival_blessing', ['MEDI_REVIVE_AS_PIVOT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const REV = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).revivesFainted);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     moves tagged revivesFainted: ' + (REV.map(m => m + ' ' + JSON.stringify(TAGS.moves[m].params.revivesFainted)).join('; ') || '(none)'));
/* the dex's own population: a legal move with a `slotCondition` whose onTryHit fails without a fainted ally */
const DEXREV = D.moves.all().filter(m => K.legal(m) && m.slotCondition && m.selfSwitch && /fainted/.test(String(m.onTryHit || '')));
console.log('     legal moves that revive (dex): ' + DEXREV.map(m => m.id).join(', '));
ok(DEXREV.length > 0 && DEXREV.every(m => REV.includes(m.id)), 'every such move carries the revivesFainted tag', 'dex ' + DEXREV.map(m => m.id) + ' vs tag ' + REV);
const MV = DEXREV[0];
if (!MV) { K.finish(); }
const USERS = SPEC.filter(s => learns(s, MV.id) && learns(s, 'protect'));
console.log('     ' + MV.id + ' learners: ' + show(USERS));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-fail|switch|drag|-heal|faint)\|/;
const counters = () => ({ failed: K.M.MEDSEEN.reviveFailedNoFainted || 0, unmodelled: K.M.MEDFAILS.reviveUnmodelled || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let FL = null;
for (const u of USERS) {
  const used = new Set([u.baseSpecies, u.id]);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
  if (fills.length < 5) continue;
  const A = [mon(u, '', [MV.name, 'Protect'], quiet(u) || undefined), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[4], '', ['Protect'])];
  const B = [mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  const R = play('fail', A, B, [{ p1: [{ m: MV.id }, P.protect], p2: [P.protect, P.protect] },
                                { p1: [P.protect, P.protect], p2: [P.protect, P.protect] }]);
  if (!R.staged) { console.log('   (skip ' + u.id + ': ' + R.why + ')'); continue; }
  R.cast = u.id + ' clicks ' + MV.id + ' with no fainted ally';
  FL = R; break;
}
const RUNS = [['FAIL', FL]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
ok(FL.sdK.some(l => /^\|-fail\|p1a:/.test(l)) && !FL.sdK.some(l => /^\|switch\|p1a:/.test(l) && FL.sdK.indexOf(l) > 4), 'FAIL — the move fails and the user stays in');

K.compareArms(RUNS, KEEP, '-fail / switch / drag / -heal / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(FL.counters.failed === 1 && FL.counters.unmodelled === 0, 'the engine\'s receipts: one failure, no revival attempted', JSON.stringify(FL.counters));
}
K.finish();
