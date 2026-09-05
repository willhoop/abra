/* arms_comparable.js — MAY THESE TWO NUMBERS BE PUT IN THE SAME TABLE?
 *
 * ROADMAP #81 WIRE 5.
 *
 *   node engine/arms_comparable.js <before.json> <after.json>
 *
 * exit 0  the two arms sampled the same population; a difference between them is the change under test
 * exit 1  they did not; a difference between them is partly the input
 * exit 2  usage / unreadable file
 *
 * WHY A SEPARATE FILE AND NOT JUST THE `--baseline` CHECK INSIDE THE DIFFERENTIAL. The `--baseline`
 * flag protects a run being taken NOW. This protects a table being written from two artifacts that
 * are already on disk — which is the actual reporting act, and the one that went wrong four times.
 * docs/ENGINE.md's WIRE 1-4 sections each carry a before/after table; each of those pairs can be put
 * through this.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK: that the engine releases differ. A before/after SHOULD have two
 * different `engine_release` ids — that is the thing under test — and a pair with the same id is a
 * REPEAT rather than a comparison. Both are printed; neither is an error, because "I re-ran the same
 * release twice to see whether the instrument is deterministic" is a legitimate and useful thing to do
 * and was in fact how this whole defect was found.
 */
'use strict';
const fs = require('fs');
const STEERING = require('./steering.js');

/* The RUN PARAMETERS that also select a sample. A 45-game run and a 395-game run are not a before/after
 * even with identical steering, and neither are two runs with different turn caps or a different set of
 * driver configurations. Compared by value; each carries the reason it matters. */
const RUN_PARAMS = [
  ['games', 'a different number of games is a different sample'],
  ['turns_cap', 'a deeper cap lets games part later, which moves every class count'],
  ['mode', 'Mode A and Mode B are different instruments'],
];

function compare(a, b) {
  const reasons = [];
  const st = STEERING.comparable(a.steering, b.steering);
  reasons.push(...st.reasons);
  for (const [k, why] of RUN_PARAMS) {
    if (a[k] === undefined || b[k] === undefined) {
      reasons.push('neither arm records `' + k + '`, so it cannot be shown equal — ' + why);
    } else if (a[k] !== b[k]) {
      reasons.push('`' + k + '` differs: ' + a[k] + ' vs ' + b[k] + ' — ' + why);
    }
  }
  /* WHAT IS STILL OUTSIDE THE CHECK, SAID OUT LOUD. A guard that overstates its reach is worse than
   * no guard — the whole reason this file exists is that four before/after pairs were published
   * against an input nobody had listed. These are the inputs that are still on nobody's list.
   *
   * The team POOL is covered (`steering.team_pool_digest`, the keys actually picked), so the raw
   * store files no longer need asserting by hand — a change to games.bo3.jsonl, games.ots.jsonl or
   * diff_swarm.js's predicates that alters the sample shows up in that digest. A change to any of
   * them that does NOT alter the sample is, correctly, not a difference. */
  /* THE DRIVER LIMIT IS COMPUTED NOW, NOT TYPED — 2026-09-05. It read "no artifact records its
   * digest" for as long as that was true, and on 2026-09-05 it stopped being true for new runs while
   * staying true for every artifact already on disk. A limits list that says the same thing whatever
   * it is handed is prose outliving what it described, which is the failure this repository is named
   * after; so the line asks the two blocks in front of it. */
  const bothStamped = !!(a.steering && a.steering.driver_code && b.steering && b.steering.driver_code);
  const limits = [
    bothStamped
      ? 'the driver is CHECKED for this pair (steering.driver_code, both arms) — but only its local '
        + 'static `require` closure. A computed require path or a dynamic import is still invisible.'
      : 'THE DRIVER ITSELF. engine/game_differential.js is not in the engine release (it is the '
        + 'instrument, not the engine) and at least one of these artifacts records no `driver_code` '
        + 'digest. On 2026-09-05 an edit to engine/empirical_driver.js moved a run from 138 to 167 '
        + 'divergences under otherwise byte-identical pins, and this check said COMPARABLE.',
    'data/protocol-events.json — the DECLARED SKIP LIST. It decides which Showdown lines are removed '
      + 'before alignment, so a change to it moves every class count in the table. Not stamped.',
    'the Showdown checkout beyond its commit hash — an uncommitted edit in SHOWDOWN_PATH is invisible '
      + 'to `showdown_commit`.',
  ];
  return { ok: !reasons.length, reasons, limits };
}

module.exports = { compare };

if (require.main === module) {
  const [pa, pb] = process.argv.slice(2);
  if (!pa || !pb) {
    console.error('usage: node engine/arms_comparable.js <before.json> <after.json>');
    process.exit(2);
  }
  const load = p => {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.error('cannot read ' + p + ': ' + e.message); process.exit(2); }
  };
  const a = load(pa), b = load(pb);
  const r = compare(a, b);
  console.log('\nARE THESE TWO ARMS COMPARABLE?');
  console.log('  before  ' + pa);
  console.log('          release ' + (a.engine_release || 'UNSTAMPED') + '   steering '
    + ((a.steering && a.steering.input_digest) || 'UNDECLARED') + '   ' + (a.games || '?') + ' games');
  console.log('  after   ' + pb);
  console.log('          release ' + (b.engine_release || 'UNSTAMPED') + '   steering '
    + ((b.steering && b.steering.input_digest) || 'UNDECLARED') + '   ' + (b.games || '?') + ' games');
  if (a.engine_release && a.engine_release === b.engine_release) {
    console.log('\n  NOTE: both arms name the SAME engine release. This is a REPEAT, not a before/after.');
  }
  if (r.ok) {
    console.log('\n  COMPARABLE. Both arms selected their sample the same way, so a difference between\n'
              + '  their numbers is the change under test.');
  } else {
    console.log('\n  NOT COMPARABLE:');
    for (const x of r.reasons) console.log('    - ' + x);
    console.log('\n  A difference between these two arms is partly the input. Do not publish it as a\n'
              + '  before/after; re-run both arms with --census pinned to the same file.');
  }
  console.log('\n  WHAT THIS CHECK CANNOT SEE:');
  for (const x of r.limits) console.log('    - ' + x);
  console.log('');
  process.exit(r.ok ? 0 : 1);
}
