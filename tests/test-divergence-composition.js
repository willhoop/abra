/* DOES THE GATE'S COMPOSITION DESCRIBE THE SAME RUN AS ITS HEADLINE?
 *
 *   node tests/test-divergence-composition.js
 *
 * ROADMAP #292. `wholeGameClause` printed a headline out of `data/game-differential.json` and a shape
 * composition out of `data/divergence-report.json` — a different file, written by a different run,
 * with no check that the two matched. Measured 2026-08-17: the headline read `287 of 1539` off
 * release `0c5bb83c5744`, while the composition beside it (`emission 132, rule 91, ordering 39,
 * unparsed 34, field 5`) came from a report whose own `run` block records 983 games, 303 diverged,
 * release `a81663f17c0c`. Shaping the CURRENT artifact gives EMISSION 116 / RULE 83 / ORDERING 52 /
 * UNPARSED 35 / FIELD 1 — `field` alone was wrong by 5x, and nothing on the line said so.
 *
 * THE FIX IS STRUCTURAL, NOT A FRESHNESS CHECK. Comparing the two files' release ids would have
 * caught this instance and left the second reader in place to drift again. The composition is now
 * computed from the artifact the headline came from, through `engine/divergence_shape.js` — the one
 * implementation of "what do these two lines disagree about" — so there is no other run it could
 * describe.
 *
 * THE CONTROL IS THE WHOLE TEST. Two synthetic artifacts with DIFFERENT compositions are fed to the
 * clause in turn, and a stale `data/divergence-report.json` is left on disk the whole time. If the
 * clause still read that file, both arms would print the same composition — and "identical results
 * across a varied knob" means the knob is unwired. The arms must DIFFER, and each must equal what the
 * shape module says about its own artifact.
 *
 * SHOWN RED ON A DELIBERATE BREAK: point `shapes` back at readJson('data/divergence-report.json') and
 * the two arms print the same numbers, failing by name.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

let bad = 0;
const ok = (cond, name, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

let Q;
try { Q = require(D('engine', 'quarantine.js')); }
catch (e) { console.log('  FAIL  cannot load engine/quarantine.js: ' + e.message); process.exit(1); }

if (typeof Q.wholeGameClause !== 'function') {
  console.log('  FAIL  engine/quarantine.js does not export wholeGameClause');
  process.exit(1);
}

console.log('\n  THE WHOLE-GAME COMPOSITION — same run as the headline, or a different one?\n');

/* Two artifacts with deliberately DIFFERENT shape mixes. The causes are real protocol shapes so the
 * shape module classifies them the way it classifies a live run's. */
const art = (games, causes) => ({
  games, diverged: causes.reduce((n, c) => n + c.n, 0), threw: 0,
  planted_divergence_proof_ok: true,
  generated: new Date().toISOString(),
  classes: [{ cls: 'synthetic', games: causes.reduce((n, c) => n + c.n, 0), causes }],
});

const ARM_A = art(1000, [
  { cause: 'ordering :: |move|p1a|protect <> |move|p2b|protect', n: 7 },          // ORDERING
  { cause: 'x :: |-damage|p1a|H/H <> |-sideend|p2:|tailwind', n: 3 },             // EMISSION
  { cause: 'x :: |-activate|p1a|x <> |-damage|p1a|H/H', n: 2 },                   // RULE
]);
const ARM_B = art(1000, [
  { cause: 'ordering :: |move|p1a|protect <> |move|p2b|protect', n: 1 },          // ORDERING
  { cause: 'x :: |-damage|p1a|H/H <> |-sideend|p2:|tailwind', n: 40 },            // EMISSION
  { cause: 'drag: a different body :: |drag|p2a|maus', n: 5 },                    // UNPARSED
]);

/* what the ONE shape implementation says about each artifact — the expected answer, derived */
const SHAPE = require(D('engine', 'divergence_shape.js'));
const expect = (a) => {
  const g = {};
  for (const c of a.classes) for (const k of c.causes) {
    const sh = SHAPE.shapeOf(k.cause).shape; g[sh] = (g[sh] || 0) + k.n;
  }
  return g;
};
const readBack = (why) => {
  const m = /\[([^\]]*)\]\s*$/.exec(String(why || ''));
  if (!m) return null;
  const out = {};
  for (const part of m[1].split(';')[0].split(', ')) {
    const p = part.trim().split(/\s+/);
    if (p.length === 2 && /^\d+$/.test(p[1])) out[p[0].toUpperCase()] = +p[1];
  }
  return out;
};

/* key ORDER is a presentation choice (the clause sorts by size); the MAP is the claim */
const canon = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));

const a = Q.wholeGameClause(ARM_A), b = Q.wholeGameClause(ARM_B);
const ga = readBack(a.why), gb = readBack(b.why);

ok(ga && Object.keys(ga).length, 'the clause prints a composition at all', JSON.stringify(ga));
ok(canon(ga) === canon(expect(ARM_A)),
   'ARM A composition == the shape module applied to ARM A',
   'printed ' + JSON.stringify(ga) + ', derived ' + JSON.stringify(expect(ARM_A)));
ok(canon(gb) === canon(expect(ARM_B)),
   'ARM B composition == the shape module applied to ARM B',
   'printed ' + JSON.stringify(gb) + ', derived ' + JSON.stringify(expect(ARM_B)));
ok(canon(ga) !== canon(gb),
   'CONTROL — the two arms DIFFER, so the composition is reading the artifact and not a fixed file',
   'A ' + JSON.stringify(ga) + '   B ' + JSON.stringify(gb));

/* The headline and the composition must count the same games. */
const headline = (r) => { const m = /(\d+) of (\d+) =/.exec(String(r.why)); return m ? [+m[1], +m[2]] : null; };
for (const [nm, r, A] of [['A', a, ARM_A], ['B', b, ARM_B]]) {
  const h = headline(r), g = readBack(r.why);
  const sum = g ? Object.values(g).reduce((x, y) => x + y, 0) : null;
  ok(h && sum === h[0] && h[1] === A.games,
     'ARM ' + nm + ' — the composition sums to the headline\'s own diverged count',
     'headline ' + JSON.stringify(h) + ', composition sums to ' + sum);
}

/* ---- THE SAME FAILURE, ONE FIELD OVER: A RATE COMPARED WITH A RATE UNDER A DIFFERENT PIN --------
 * ROADMAP #292 second half. The baseline carries the `mode` it was stamped under. Measured
 * 2026-08-17: baseline `A/top-tie-first/pins:ef342837b791` at 30.8%, run `A/middle/pins:1fd77b835ee2`
 * at 61.2% — a different ARM with a different die model, whose OWN top-tie-first arm read 14.7% on
 * the same games. The clause printed `AND IT GOT WORSE` about a 30-point rise that is entirely the
 * instrument changing corner. The trend must be WITHHELD, not annotated.
 *
 * THE CONTROL IS AN ARTIFACT CARRYING THE BASELINE'S OWN MODE. If the mode check were unwired both
 * arms would print a trend, and identical behaviour across a varied knob means the knob is dead. */
{
  const fs = require('fs');
  let base = null;
  try { base = JSON.parse(fs.readFileSync(D('data', 'whole-game-baseline.json'), 'utf8')); } catch (e) { /* none */ }
  if (!base || !base.mode) {
    console.log('  SKIP  data/whole-game-baseline.json carries no `mode` — cannot test the pin guard.');
    bad++;
  } else {
    const same = Object.assign({}, ARM_A, { mode: base.mode });
    const diff = Object.assign({}, ARM_A, { mode: base.mode + '/DIFFERENT-PIN' });
    const rs = Q.wholeGameClause(same), rd = Q.wholeGameClause(diff);
    ok(rs.baseline_comparable === true && rs.progress !== null,
       'a run under the BASELINE OWN mode still reports a direction of travel',
       'mode ' + base.mode + ' -> progress ' + JSON.stringify(rs.progress));
    ok(rd.baseline_comparable === false && rd.progress === null && rd.regressed === null
       && /WITHHELD/.test(String(rd.why)),
       'CONTROL — a run under a DIFFERENT pin has its trend WITHHELD, not annotated',
       'progress ' + JSON.stringify(rd.progress) + '; ' + String(rd.why).slice(-150));
    ok(rs.ok === rd.ok,
       'the VERDICT does not depend on the pin comparison — correctness decides it',
       'same-mode ok=' + rs.ok + ', different-mode ok=' + rd.ok);
  }
}

/* UNPARSED must be named for what it is rather than read as a fifth disagreement. */
ok(/unparsed is not a disagreement/.test(String(b.why)),
   'UNPARSED is annotated with the class that produced it, not printed bare',
   String(b.why).slice(-170));

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
