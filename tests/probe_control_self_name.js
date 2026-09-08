/* probe_control_self_name.js — THE ABILITY-SWAP CONTROL DESCRIBES ITSELF, AND THE ROSTER COUNTS IT.
 *
 * WHAT THIS ASKS. `tests/roster.js` measures an ability by playing the identical scenario twice, once
 * with the ability in the slot and once with a species-legal ALTERNATE in it, and diffing the two
 * boards leaf for leaf. `engine/board_state.js` writes the carrier's ability onto TWO leaves — the
 * active slot (`p2.active[0].ability`) and the party row (`p2.party.<species>.ability`) — so the
 * control arm CANNOT be played without moving them. Four boundaries x two leaves x two engines is
 * SIXTEEN leaves of "evidence" that exist for every ability row by construction and say nothing about
 * the ability.
 *
 * THIS IS THE FOCUS SASH DEFECT ON THE ABILITY AXIS (docs/_reports/2026-09-07-focus-sash-blind-test.md).
 * There the control arm took the ITEM off, the party row said so, and Focus Sash's entire FIRED
 * evidence was four `p2.party.meowscarada.item` leaves. `controlOf` was taught to ignore both item
 * leaves. The ability branch of the same function ignores NOTHING.
 *
 * THE ONE THING A BLANKET IGNORE WOULD DESTROY, and why this probe has a third clause. For Trace,
 * Receiver, Protean and every forme change the `.ability` leaf is THE EFFECT — Gardevoir's slot really
 * does stop saying `trace` and start saying the foe's ability. So the exclusion must be conditioned on
 * the VALUES: drop the leaf only when it reads `with=<the ability under test> without=<that arm's
 * control ability>`, which is the swap and nothing else.
 *
 * THREE CLAUSES, AND EACH ONE HAS TO BE ABLE TO GO BOTH WAYS:
 *
 *   A  LEAF GUARD on Meganium is FIRED-AND-BOARDS-MATCH today on 8 leaves, ALL of them the swap.
 *      Leaf Guard blocks status in sun; the generic fixture has no sun and no status, so the fixture
 *      is inert and the row is a green about nothing. It must stop being FIRED.
 *   B  CONTRARY on Serperior is FIRED-AND-BOARDS-MATCH today on 24 leaves that are Attack stages.
 *      It must STAY FIRED. Clause A without clause B is satisfied by deleting the ability stage.
 *   C  TRACE on Gardevoir is CONTROL-NOT-QUIET today, and its delta contains
 *      `p2.active[0].ability with=pressure` — the copy actually happening, in BOTH engines. It must
 *      come out FIRED-AND-BOARDS-MATCH. Clause C is what refuses the blanket ignore.
 *
 * AND THE ASSERTION IS PROVED TO BE REACHED. Ten self-tests in four days were found passing while
 * asserting nothing. So this counts the `.ability` leaves it actually inspected on each row and FAILS
 * if the count is zero — a row that carries no ability leaf at all would satisfy clause A vacuously,
 * and that would be the probe agreeing with itself.
 *
 *   SHOWDOWN_PATH=... node tests/probe_control_self_name.js
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REL = require(path.join(ROOT, 'data', 'engine-release.json')).current;
if (!REL) { console.error('FAIL  data/engine-release.json has no `current` id'); process.exit(1); }
if (!process.env.SHOWDOWN_PATH) {
  console.error('FAIL  SHOWDOWN_PATH is not set — the differential cannot run and this probe would '
              + 'report nothing while looking like it ran.');
  process.exit(1);
}

/* One roster run per row, `--json` so nothing is written to data/. */
function row(id) {
  const out = execFileSync(process.execPath,
    [path.join(ROOT, 'tests', 'roster.js'), '--stage', 'abilities', '--only', id,
     '--json', '--release', REL],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: process.env });
  const i = out.lastIndexOf('\n{');
  if (i < 0) throw new Error('roster.js --json printed no artifact for ' + id);
  const art = JSON.parse(out.slice(i + 1));
  const r = (art.results || []).find(x => x.id === id);
  if (!r) throw new Error('roster.js returned no row for ' + id + ' (results: '
                          + (art.results || []).length + ')');
  /* THE COUNTER IS THE RECEIPT THAT THE CORRECTION REACHED THIS ROW'S LEAVES. Without it clause A is
   * satisfied by a roster that never staged Leaf Guard at all, which is the dead-anchor failure. A
   * MISSING key is a failure and not a zero: an older roster.js publishes no such key and would
   * otherwise read as "there was nothing to correct". */
  const K = art.swap_leaf_correction;
  if (!K || typeof K.self_describing_dropped !== 'number'
         || typeof K.real_ability_rewrite_kept !== 'number')
    throw new Error('roster.js published no `swap_leaf_correction` counter for ' + id
                  + ' - this probe cannot tell a correction that ran from one that does not exist');
  r._k = K;
  return r;
}

/* EVERY LEAF THE ROW WAS ALLOWED TO SEE, from wherever the verdict path put it. A released row keeps
 * its evidence on `sd_delta`/`us_delta`; an unattributable one keeps it on `second_control.dropped`
 * as printable strings. Both are parsed to the same shape so the clauses cannot be reading different
 * populations. */
const DROPPED = /^(showdown|ours) turn (\d+) (\S+) with=(\S+) without=(\S+)$/;
function leaves(r) {
  const out = [];
  for (const d of (r.sd_delta || []).concat(r.us_delta || []))
    out.push({ path: d.path, with: String(d.with), without: String(d.without) });
  for (const s of ((r.second_control && r.second_control.dropped) || [])) {
    const m = DROPPED.exec(s);
    if (!m) { console.error('  !! a dropped-leaf string did not parse: ' + s); continue; }
    out.push({ path: m[3], with: m[4], without: m[5] });
  }
  return out;
}
const abilityLeaves = L => L.filter(x => /\.ability$/.test(x.path));
/* the swap and nothing else: the slot says the ability under test in one arm and the control's in the
 * other. `with` is the SUBJECT arm's value — see armDelta, which pushes `with: d.medicham`. */
const selfName = (x, id) => x.with === id;

let fails = 0, checked = 0;
const say = (ok, tag, msg) => { if (!ok) fails++; checked++;
  console.log((ok ? '  ok    ' : '  FAIL  ') + tag + '  ' + msg); };

console.log('probe_control_self_name — release ' + REL);
console.log('');

/* ---- A ---------------------------------------------------------------------------------------- */
const A = row('leafguard');
const AL = abilityLeaves(leaves(A));
console.log('A  Leaf Guard / ' + A.carrier + '   verdict=' + A.verdict);
console.log('     ability leaves inspected: ' + AL.length + '  of which the swap itself: '
            + AL.filter(x => selfName(x, 'leafguard')).length);
console.log('     correction counter: ' + A._k.self_describing_dropped + ' swap leaves dropped, '
            + A._k.real_ability_rewrite_kept + ' real rewrites kept');
say(A._k.self_describing_dropped > 0, 'A0',
    'the assertion is REACHED — the correction inspected and dropped ' + A._k.self_describing_dropped
    + ' swap leaf/leaves on this row. Zero would mean the row was never staged, or the correction '
    + 'never reached a leaf, and clause A2 below would be vacuous.');
say(A._k.real_ability_rewrite_kept === 0 && AL.every(x => selfName(x, 'leafguard')), 'A1',
    'NOTHING on this row is a real ability rewrite, so the fixture offers no ability-change evidence '
    + 'at all and A2 is aimed at a genuinely vacuous row. If this goes false the fixture changed.');
say(A.verdict !== 'FIRED-AND-BOARDS-MATCH', 'A2',
    'Leaf Guard is NOT counted as tested. Its whole delta is the control arm describing itself; a '
    + 'green here is agreement that both engines write the ability name we set. Got ' + A.verdict + '.');

/* ---- B ---------------------------------------------------------------------------------------- */
const B = row('contrary');
const BL = leaves(B);
console.log('');
console.log('B  Contrary / ' + B.carrier + '   verdict=' + B.verdict);
const Breal = BL.filter(x => !/\.ability$/.test(x.path));
console.log('     real (non-ability) leaves: ' + Breal.length + '   e.g. '
            + (Breal[0] ? Breal[0].path + ' ' + Breal[0].with + '/' + Breal[0].without : 'NONE'));
console.log('     correction counter: ' + B._k.self_describing_dropped + ' swap leaves dropped');
say(Breal.length > 0 && B._k.self_describing_dropped > 0, 'B0',
    'the assertion is REACHED — the correction fired on THIS row too ('
    + B._k.self_describing_dropped + ' swap leaves dropped) and it still holds ' + Breal.length
    + ' leaf/leaves that are not an ability field. A green here is therefore not the correction '
    + 'quietly being off for the one row that had to survive it.');
say(B.verdict === 'FIRED-AND-BOARDS-MATCH', 'B1',
    'a green that rests on REAL leaves keeps its green. Got ' + B.verdict + '.');

/* ---- C ---------------------------------------------------------------------------------------- */
const C = row('trace');
const CL = abilityLeaves(leaves(C));
const Ccopy = CL.filter(x => !selfName(x, 'trace'));
console.log('');
console.log('C  Trace / ' + C.carrier + '   verdict=' + C.verdict);
console.log('     ability leaves: ' + CL.length + '   of which a REAL copy (with != trace): '
            + Ccopy.length + (Ccopy[0] ? '   e.g. ' + Ccopy[0].path + ' with=' + Ccopy[0].with : ''));
console.log('     correction counter: ' + C._k.self_describing_dropped + ' swap leaves dropped, '
            + C._k.real_ability_rewrite_kept + ' real rewrites kept');
say(Ccopy.length > 0 && C._k.real_ability_rewrite_kept > 0, 'C0',
    'the assertion is REACHED — Trace really did rewrite its own slot on this fixture, so there is '
    + 'something for a value-conditioned ignore to preserve. Zero here means the fixture stopped '
    + 'exercising Trace and clause C proves nothing.');
say(C.verdict === 'FIRED-AND-BOARDS-MATCH', 'C1',
    'Trace is released to a real verdict. The exclusion must be conditioned on the VALUES; a blanket '
    + 'ignore of `.ability` would delete exactly this evidence and leave Trace unattributable for '
    + 'ever. Got ' + C.verdict + '.');

console.log('');
console.log(fails ? 'RED   ' + fails + ' of ' + checked + ' clauses failed'
                  : 'GREEN ' + checked + ' clauses, all reached and all passed');
process.exit(fails ? 1 : 0);
