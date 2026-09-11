#!/usr/bin/env node
/* tests/probe_roster_learnset_refusals.js — ROADMAP #318, the count the row says must reach zero.
 * ==================================================================================================
 * HOW MANY BODY/MOVE PAIRS DOES THE DELIBERATE ROSTER STAGE THAT THE FORMAT WOULD REFUSE?
 *
 * The roster publishes no such count (data/roster.*.json carry no learnset key), and its fixture
 * audit runs in REPORT mode (tests/roster.js, the `learnsetMode: 'report'` block), so the figure is
 * printed on a run and then lost. This probe re-derives it WITHOUT PLAYING A GAME, through the
 * roster's OWN doors:
 *
 *   tests/roster.js  `assign(kind)`        — the exported staging derivation main() calls before any
 *                                            game; it returns each entity's scenario (A, B, script)
 *   tests/staged_board.js `fixtureAudit`   — the SAME audit main() calls, with the same options: the
 *                                            control click exempt (ROADMAP #316) and report mode on.
 *                                            Its REPORT-ONLY line is the roster's own count.
 *
 * Nothing here decides legality. `fixtureAudit` asks Showdown's TeamValidator.
 *
 * THE CONTROL IS THE AUDIT ITSELF, ON TWO KNOWN SHELLS. A legal pair (Garchomp / Rock Slide) must
 * report 0 and a pair on data/fixture-learnset-baseline.json (Snorlax / Swords Dance) must report 1,
 * through the same options. If either fails the count below cannot be believed and the run refuses.
 *
 * WHAT GREEN MEANS: 0 refused pairs across the three stages. The row's figure was 632 on 2026-08-21;
 * it is re-measured here, not quoted.
 *
 * PINNED: `--release 2b5a6585d8cf` unless another is given — staged_board and the driver both read
 * the flag, so a bare run would CUT a release over the live tree.
 * EXIT: 0 green / 1 red (refusals remain) / 2 cannot answer (a control failed, or nothing staged).
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
if (process.argv.indexOf('--release') < 0) process.argv.push('--release', '2b5a6585d8cf');
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];

const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };

console.log('\ntests/probe_roster_learnset_refusals.js — ROADMAP #318   release ' + REL_ID);

let R, SB;
const log = console.log;
try {
  console.log = () => {};
  SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
  R = require(path.join(ROOT, 'tests', 'roster.js'));
} catch (e) { console.log = log; cannot('the roster or staged_board would not load: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
finally { console.log = log; }
if (typeof R.assign !== 'function' || typeof SB.fixtureAudit !== 'function')
  cannot('tests/roster.js no longer exports assign(), or staged_board no longer exports fixtureAudit()');

/* The roster's own control-click and report-mode options, quoted from its call site. */
const INERT = 'focusenergy';
const OPTS = {
  learnsetExempt: INERT,
  learnsetExemptWhy: 'the roster\'s control click (ROADMAP #316), exempt exactly as tests/roster.js exempts it',
  learnsetMode: 'report',
  learnsetModeWhy: 'measuring the report-only bucket tests/roster.js prints and does not publish (ROADMAP #318)',
};
function audit(shells) {
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  let bad;
  try { bad = SB.fixtureAudit(shells, OPTS); } finally { console.log = log; }
  const m = lines.join('\n').match(/REPORT-ONLY FOR THIS CALLER:\s*(\d+) body\/move pair\(s\)[^\n]*?over (\d+) bodies/);
  const top = (lines.find(l => /^\s+[a-z0-9]+ \d+(, [a-z0-9]+ \d+)*/.test(l) && !/LEARNSET/.test(l)) || '').trim();
  return { n: m ? +m[1] : (lines.some(l => /REPORT-ONLY/.test(l)) ? NaN : 0), bodies: m ? +m[2] : 0, top, bad, lines };
}

/* ---- CONTROLS ---------------------------------------------------------------------------------- */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const shell = (m) => ([{ id: '(control)', A: [m, mon('clefable', '', 'Unaware', ['Protect'])],
  B: [mon('corviknight', '', 'Pressure', ['Protect']), mon('toxapex', '', 'Regenerator', ['Protect'])],
  script: [{ p1: [{ m: m.moves[0], t: 0 }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }] }]);
const cLegal = audit(shell(mon('garchomp', '', 'Rough Skin', ['Rock Slide'])));
const cBad = audit(shell(mon('snorlax', '', 'Thick Fat', ['Swords Dance'])));
console.log('\n  CONTROL — the audit, through the roster\'s options, on two known shells:');
console.log('      garchomp | rockslide   (legal)          reported ' + cLegal.n);
console.log('      snorlax  | swordsdance (on the baseline) reported ' + cBad.n);
if (cLegal.n !== 0 || cBad.n !== 1)
  cannot('the audit did not separate a legal pair from a refused one (' + cLegal.n + ' / ' + cBad.n
    + '), so a count from it would say nothing');

/* ---- THE MEASUREMENT --------------------------------------------------------------------------- */
const perKind = {};
const allShells = [];
for (const k of ['item', 'ability', 'move']) {
  let a;
  console.log = () => {};
  try { a = R.assign(k); } catch (e) { console.log = log; cannot('assign(' + k + ') threw: ' + String(e && e.message || e)); }
  finally { console.log = log; }
  const staged = (a.entries || []).filter(e => e.scenario);
  const shells = staged.map(e => ({ id: e.scenario.id, A: e.scenario.A, B: e.scenario.B, arm: e.scenario.arm,
    script: e.scenario.script.map(st => ({ p1: st.p1.map(x => (x && x.sw ? null : x)),
                                           p2: st.p2.map(x => (x && x.sw ? null : x)) })) }));
  const r = audit(shells);
  perKind[k] = { entries: (a.entries || []).length, staged: staged.length, refused: r.n, bodies: r.bodies, top: r.top };
  allShells.push(...shells);
}
const all = audit(allShells);
if (!allShells.length) cannot('assign() staged nothing in any of the three stages');

console.log('\n  THE ROSTER\'S FIXTURES, AUDITED THE WAY tests/roster.js AUDITS THEM (no game played):');
for (const [k, v] of Object.entries(perKind))
  console.log('      ' + (k + ' stage').padEnd(14) + String(v.staged).padStart(4) + ' staged of ' + String(v.entries).padStart(4)
    + '   refused pairs ' + String(v.refused).padStart(4) + ' over ' + v.bodies + ' bodies   ' + v.top.slice(0, 90));
console.log('      ALL THREE (distinct pairs)  refused ' + all.n + ' over ' + all.bodies + ' bodies');
console.log('      concentration: ' + all.top);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + detail);
  if (!cond) bad++;
};
console.log('');
ok(Number.isFinite(all.n), 'the report-only count was found in the audit output',
   Number.isFinite(all.n) ? null : 'the audit printed REPORT-ONLY without a parsable count');
ok(all.n === 0,
   'the deliberate roster stages no body/move pair the format refuses',
   all.n ? all.n + ' distinct refused pair(s) across the three stages; the cell is the heaviest body: '
     + (all.top.split(',')[0] || '?') + ' — the move stage\'s fixed carrier (tests/roster.js, the '
     + '`learnsetMode: \'report\'` block). The repair is to derive the carrier from each move\'s own learnset.' : null);

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
