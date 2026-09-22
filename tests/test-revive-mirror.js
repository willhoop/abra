#!/usr/bin/env node
/* tests/test-revive-mirror.js — THE DIFFERENTIAL ANSWERS A REVIVAL REQUEST, SO A REVIVE IS COMPARED INSTEAD OF THROWN.
 * 2026-09-22 (MEASURE, abra/regmc 0.40.0).
 *
 *   node tests/test-revive-mirror.js --regulation regmc                          # green, exit 0
 *   GD_REVIVE_UNANSWERED=1 node tests/test-revive-mirror.js --regulation regmc   # RED, exit 1 (the old road: the game throws)
 *
 * THE DEFECT (filed by ENGINE, docs/_reports/2026-09-22-regmc-engine.md §6). A move that revives a fainted ally (found by
 * the `revivesFainted` tag) raises a SWITCH request on its user's slot that the authority answers only with a FAINTED
 * party member (M-C checkout `sim/side.ts` chooseSwitch: "Can't switch: You have to pass to a fainted Pokémon").
 * `mirrorForcedSwitch` looks for a LIVE bench body, so the harness named the body medicham2 had pivoted in, the authority
 * refused it, and the game THREW. The pinned Reg M-C differential's refused-choice counter was exactly those games.
 *
 * THE ARM (scripted, both engines play the same turns; SHOWDOWN IS THE ANSWER):
 *   turn 1  p1b clicks a self-fainting move whose target is itself (derived: `selfdestruct` set, `target: 'self'`), so
 *           a fainted body exists; the replacement is mirrored as any forced switch is.
 *   turn 2  p1a clicks the revive move.
 * Asserted: the game plays through (no throw, no refused choice), exactly one revival request was ANSWERED by the new
 * branch, the authority revived a body (`-heal ... [from] move: <the move>`), and the turn-2 board was COMPARED (leaves
 * compared at every boundary). Whether the two boards AGREE there is printed and NOT asserted: it is the engine's
 * revive road (`MEDFAILS.reviveUnmodelled`), ENGINE's to fix, and the point of this change is that it can now be seen. */
'use strict';
const K = require('./regmc_probe_kit.js').open('test-revive-mirror', ['GD_REVIVE_UNANSWERED']);
const path = require('path');
const fs = require('fs');
const { G, D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const REV = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).revivesFainted);
const SELFKO = D.moves.all().filter(m => K.legal(m) && m.selfdestruct && m.target === 'self' && m.category === 'Status');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     moves tagged revivesFainted: ' + (REV.join(', ') || '(none)'));
console.log('     legal self-fainting status moves aimed at the user: ' + (SELFKO.map(m => m.id + ':' + m.selfdestruct).join(', ') || '(none)'));
if (!REV.length || !SELFKO.length) { console.log('  NOT STAGED — no revive move or no self-fainting move in this regulation.'); process.exit(1); }
const MV = D.moves.get(REV[0]);
const KO = SELFKO[0];
const USERS = SPEC.filter(s => learns(s, MV.id) && learns(s, 'protect'));
const KOERS = SPEC.filter(s => learns(s, KO.id) && quiet(s)).sort((a, b) => bulk(b) - bulk(a));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
console.log('     ' + MV.id + ' learners: ' + show(USERS) + '    ' + KO.id + ' learners (quiet): ' + show(KOERS));

const KEEP = /^\|(-fail|switch|drag|-heal|faint)\|/;
const counters = () => Object.assign({ unmodelled: K.M.MEDFAILS.reviveUnmodelled || 0 },
  Object.fromEntries(Object.entries(G.reviveCounters()).filter(([k]) => k !== 'first')));
let R = null;
for (const u of USERS) {
  for (const k of KOERS) {
    if (k.baseSpecies === u.baseSpecies) continue;
    const used = new Set([u.baseSpecies, u.id, k.baseSpecies, k.id]);
    const f = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
    if (f.length < 5) continue;
    const A = [mon(u, '', [MV.name, 'Protect'], quiet(u) || undefined), mon(k, '', [KO.name, 'Protect'], quiet(k) || undefined),
               mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect'])];
    const B = [mon(f[2], '', ['Protect']), mon(f[3], '', ['Protect']), mon(f[4], '', ['Protect']), mon(f[1], '', ['Protect'])];
    const r = K.play('revive', A, B, [{ p1: [P.protect, { m: KO.id }], p2: [P.protect, P.protect] },
                                      { p1: [{ m: MV.id }, P.protect], p2: [P.protect, P.protect] }], KEEP, counters);
    if (!r.staged && !/THREW/.test(r.why)) { console.log('   (skip ' + u.id + '/' + k.id + ': ' + r.why + ')'); continue; }
    r.cast = u.id + ' clicks ' + MV.id + ' on turn 2 after ' + k.id + ' used ' + KO.id + ' on turn 1';
    R = r; break;
  }
  if (R) break;
}
K.printArms([['REVIVE', R]]);

console.log('\n3. THE ANSWER');
const c = R.counters;
ok(c.requests === 1, 'exactly one revival request reached the driver, and it was answered', JSON.stringify(c));
ok(c.mirrored + c.authority_default === 1 && c.no_fainted_body === 0,
  'answered with a fainted body: ' + (c.mirrored ? 'MIRRORED from the revive medicham2 made' : 'the authority\'s own default (medicham2 revived nothing)'));
ok(G.choiceCounters().refused === 0, 'the authority refused none of the harness\'s choices', JSON.stringify(G.choiceCounters()));
const healRe = new RegExp('^\\|-heal\\|p1[ab]?: [^|]+\\|[^|]*\\|\\[from\\] move: ' + MV.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
const heal = R.sd.find(l => healRe.test(l));
ok(!!heal, 'the authority revived a body (' + MV.name + '\'s -heal line)', heal || R.sd.filter(l => /heal|switch|faint/.test(l)).join('\n'));

console.log('\n4. THE REVIVE, COMPARED (reported, not asserted -- the engine road is ENGINE\'s)');
console.log('     medicham2 counted the revive unmodelled: ' + c.unmodelled + ' time(s)');
console.log('     board differences across the game: ' + R.boardDiffs + (R.boardDetail ? '   ' + R.boardDetail : ''));
console.log('     first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none'));
K.finish();
