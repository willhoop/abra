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

/* ---- WHICH CLAUSE THIS FILE IS ABOUT, AND WHY IT MOVED ON 2026-09-04 ----------------------------
 * The whole-game clause was SPLIT on Will's 2026-08-22 ruling (*"board-material now, narration as its
 * own separate gate afterwards"*): `wholeGameClause` now counts BOARD-MATERIAL games —
 * `state.games` less `state.games_board_never_diverged` — and `narrationClause` counts PROTOCOL FIRST
 * DIVERGENCE and reports without gating.
 *
 * EVERY ASSERTION BELOW IS ABOUT `classes[].causes[]`, WHICH ARE PROTOCOL CAUSES. A board divergence
 * is a leaf PATH and carries no cause, so there is nothing here the board clause could compose. The
 * quantity this file guards went with narration, so this file follows it. ROADMAP #292 is a protocol
 * question and always was.
 *
 * THE TWO CLAUSES SHARE ONE DOOR (`wholeGameDoor`), so the refusal arms further down assert the same
 * behaviour through either caller — measured, not assumed: with the same fixtures both clauses return
 * `withheld: true` with an identical `pins.checked` list. That is why the repoint could not quietly
 * turn a refusal arm green, and it is asserted below rather than left as a claim in a comment. */
if (typeof Q.narrationClause !== 'function') {
  console.log('  FAIL  engine/quarantine.js does not export narrationClause');
  process.exit(1);
}

console.log('\n  THE WHOLE-GAME COMPOSITION — same run as the headline, or a different one?\n');

/* THE POPULATION IS PART OF THE QUESTION (2026-09-03). `wholeGameClause` refuses outright unless the
 * artifact declares it was played under the published driver, so a fixture that omits `steering` gets
 * a refusal and never reaches the composition at all. The constant is IMPORTED, never typed: a rename
 * in engine/steering.js must break loudly here rather than silently turn these arms into refusals —
 * which is exactly how this file went red on 2026-09-03 while still reporting a composition failure.
 * ARM_NO_STEERING below keeps that refusal branch covered. */
const STEERING = require(D('engine', 'steering.js'));

/* ---- AND THE SAME THING HAPPENED AGAIN ONE DAY LATER, WHICH IS WHY THE PIN IS IMPORTED TOO -------
 *
 * 2026-09-04. `engine/pin_guard.js` extended the refusal from the steering POLICY to the whole
 * declaration — the release stamp, its `source_digests`, and every SELECTOR `steering.vouches()`
 * names (the behaviour tables under the empirical policy, and `team_pool_digest`, which
 * `wholeGameClause` recorded and never read). These arms carried the policy and nothing else, so all
 * eleven of them turned into refusals and this file went red for the second time in two days for the
 * same reason: a fixture that declares less than a real artifact does.
 *
 * NOTHING HERE IS TYPED. The pin key names come from `engine_release.STAMP_SHAPE` and the selector
 * shape from `steering.js`, so a rename breaks this file loudly instead of quietly turning its arms
 * into refusals — which is the failure mode this comment block already existed to record. */
const ER = require(D('engine', 'engine_release.js'));
const RELPIN = (() => {
  const ptr = JSON.parse(require('fs').readFileSync(D('data', 'engine-release.json'), 'utf8'));
  const id = ptr.id || ptr.release || ptr.current;
  return { [ER.STAMP_SHAPE.id]: id,
           /* a synthetic digest map: the guard asks whether the artifact CAN be verified by content,
            * and verifying it is provenance.js's job over real files, never this fixture's */
           [ER.STAMP_SHAPE.digests]: { 'engine/medicham2-browser.js': 'fixture0000f' } };
})();
const STEER_FULL = () => ({ policy: STEERING.POLICY_EMPIRICAL,
  driver_inputs: [{ file: 'data/move-priors.json', digest: 'fixtureprior' }],
  team_pool_digest: 'fixturepool0' });

/* Two artifacts with deliberately DIFFERENT shape mixes. The causes are real protocol shapes so the
 * shape module classifies them the way it classifies a live run's. */
/* ---- AND A THIRD TIME, ONE DAY LATER AGAIN — THE BY-CAUSE SPLIT, 2026-09-06 --------------------
 *
 * `narrationClause` stopped judging `j.diverged` and now judges
 * `end_state[0].summary.by_cause_totals.games_narration_only` — the games that diverge in narration
 * and NEVER part a board — because 46 of the 151 diverged games in the last real artifact ALSO part
 * a board and are the BOARD-MATERIAL clause's. An artifact with no reconciled split is WITHHELD, on
 * purpose and with no fallback, so a fixture that declares less than a real artifact does turns every
 * arm below into a refusal. That is the third occurrence of the exact failure the two comment blocks
 * above record, so the split is DERIVED from the fixture's own causes rather than typed beside them:
 * every synthetic cause here is narration-only, and the totals are computed, never asserted. */
const endStateFor = (causes) => {
  const rows = causes.map((c) => ({ cause: c.cause, games: c.n, board_parted: 0,
    board_never_parted: c.n, materiality: 'NARRATION-ONLY' }));
  const total = rows.reduce((n, r) => n + r.games, 0);
  return [{ summary: { by_cause: rows, by_cause_totals: {
    causes: rows.length, games: total, BOARD_MATERIAL: 0, NARRATION_ONLY: rows.length,
    games_board_material: 0, games_narration_only: total, games_unknown: 0,
    by_cause_reconciles: true, bounded_by: 'fixture' } } }];
};
const art = (games, causes) => ({
  ...RELPIN,
  games, diverged: causes.reduce((n, c) => n + c.n, 0), threw: 0,
  planted_divergence_proof_ok: true,
  generated: new Date().toISOString(),
  steering: STEER_FULL(),
  classes: [{ cls: 'synthetic', games: causes.reduce((n, c) => n + c.n, 0), causes }],
  end_state: endStateFor(causes),
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

const a = Q.narrationClause(ARM_A), b = Q.narrationClause(ARM_B);
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

/* ---- THIRD ARM: NO STEERING BLOCK AT ALL, AND THE CLAUSE MUST REFUSE ---------------------------
 * 2026-09-04. The two arms above were built WITHOUT a `steering` block and stopped composing anything
 * on 2026-09-03, when `wholeGameClause` began refusing an artifact that does not declare the
 * published driver. Adding the block repairs them — and, on its own, DELETES ALL COVERAGE OF THE
 * BRANCH THAT BROKE THEM: the fixture would go green by no longer exercising the thing just built.
 * That is this repository's signature failure (a green test asking nothing), so the refusal gets its
 * own arm.
 *
 * IT IS A CONTROL, NOT A GREP. ARM_NO_STEERING is byte-identical to ARM_A except for the one key, and
 * ARM_A is asserted above to compose a real shape map. So the knob is varied and the two outcomes
 * DIFFER — composition vs refusal. A test that only checked the refusal would pass against a clause
 * that refused everything.
 *
 * SHOWN RED ON A DELIBERATE BREAK: delete the `pol !== STEERING.POLICY_EMPIRICAL` guard in
 * engine/quarantine.js and this arm fails by name — the artifact composes instead of being withheld. */
{
  const ARM_NO_STEERING = Object.assign({}, ARM_A);
  delete ARM_NO_STEERING.steering;
  const r = Q.narrationClause(ARM_NO_STEERING);

  ok(r.ok === false && r.cannot_answer === true && r.withheld === true,
     'CONTROL — an artifact with NO steering block is REFUSED, not answered',
     'ok=' + r.ok + ' cannot_answer=' + r.cannot_answer + ' withheld=' + r.withheld);
  ok(r.wanted_steering_policy === STEERING.POLICY_EMPIRICAL && r.steering_policy == null,
     'the refusal names the driver it wanted and reports the artifact declared none',
     'wanted ' + JSON.stringify(r.wanted_steering_policy)
       + ', artifact ' + JSON.stringify(r.steering_policy));
  ok(readBack(r.why) === null && headline(r) === null,
     'the figures are WITHHELD — no composition and no headline are printed beside the refusal',
     'composition ' + JSON.stringify(readBack(r.why)) + ', headline ' + JSON.stringify(headline(r)));
  ok(canon(readBack(a.why)) !== canon(readBack(r.why)),
     'CONTROL — the SAME artifact with the steering block composes, so the guard is the difference',
     'with steering ' + JSON.stringify(readBack(a.why))
       + ', without ' + JSON.stringify(readBack(r.why)));

  /* ---- THE TWO REFUSALS ADDED 2026-09-04, EACH WITH ITS OWN ARM FOR THE SAME REASON AS ABOVE ----
   * Repairing `art()` above without these would delete the coverage of what just broke it. Both are
   * byte-identical to ARM_A but for the one field, and ARM_A is asserted to compose, so the knob is
   * varied and the two outcomes differ. */
  const ARM_NO_PIN = Object.assign({}, ARM_A);
  delete ARM_NO_PIN[ER.STAMP_SHAPE.id]; delete ARM_NO_PIN[ER.STAMP_SHAPE.digests];
  const rp = Q.narrationClause(ARM_NO_PIN);
  /* `withheld === true` ALONE CANNOT TELL WHICH DOOR REFUSED, and this file holds four fixtures that
   * are each refused for a DIFFERENT reason. A clause that refused everything — or that refused this
   * one on steering — would satisfy a bare `withheld` check and be read as coverage of the pin.
   * 2026-09-04: this arm was the weakest of the three and it is the one a repoint could have carried
   * green. So it also asserts the refusal NAMES the field the fixture deleted. The name is IMPORTED
   * from `engine_release.STAMP_SHAPE`, never typed, so a rename there fails here loudly. */
  ok(rp.ok === false && rp.withheld === true
     && new RegExp(ER.STAMP_SHAPE.id).test(String(rp.why || ''))
     && String(rp.pins && rp.pins.checked) !== String(r.pins && r.pins.checked),
     'CONTROL — an artifact with NO release stamp is REFUSED: it cannot say which engine produced '
     + 'the games it is composing, and the refusal NAMES the pin rather than some other door',
     'ok=' + rp.ok + ' withheld=' + rp.withheld
       + ' checked=' + JSON.stringify(rp.pins && rp.pins.checked)
       + ' (the steering refusal checked ' + JSON.stringify(r.pins && r.pins.checked) + ')');
  /* ONE DOOR, TWO CALLERS — the property that made the 2026-09-04 repoint safe, asserted rather than
   * assumed. If the pin refusal ever sits on only one of the two clauses, this file is testing a
   * caller that still looks while the other has stopped, which is the shape of a green-by-not-looking
   * regression. It asserts the OUTCOME, not the receipt, so a cosmetic change to either is free. */
  ok(Q.wholeGameClause(ARM_NO_PIN).withheld === true && rp.withheld === true,
     'CONTROL — BOTH whole-game clauses refuse the unpinned artifact, so the door is shared and this '
     + 'file is not the only caller that still looks',
     'board withheld=' + Q.wholeGameClause(ARM_NO_PIN).withheld + ' narration withheld=' + rp.withheld);
  ok(readBack(rp.why) === null && headline(rp) === null,
     'and no composition and no headline are printed beside THAT refusal either',
     'composition ' + JSON.stringify(readBack(rp.why)) + ', headline ' + JSON.stringify(headline(rp)));

  const ARM_NO_POOL = Object.assign({}, ARM_A, { steering: STEER_FULL() });
  delete ARM_NO_POOL.steering.team_pool_digest;
  const rt = Q.narrationClause(ARM_NO_POOL);
  ok(rt.ok === false && rt.withheld === true && /team_pool_digest/.test(rt.why || ''),
     'CONTROL — the right POLICY with no `team_pool_digest` is REFUSED. That field was already in '
     + 'the artifact and the clause read only `policy`, so a run against the wrong team pool passed',
     'ok=' + rt.ok + ' withheld=' + rt.withheld + ' why=' + String(rt.why || '').slice(0, 120));
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
    const rs = Q.narrationClause(same), rd = Q.narrationClause(diff);
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
