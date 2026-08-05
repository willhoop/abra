/* THE SHRINK GUARD — proved against the run that defeated it.
 *
 * On 2026-08-05 the interaction matrix measured 899 of 899 live cases agreeing with the official
 * engine — 100.0%, its best result — and the guard refused to publish, advising "Re-run with --full
 * to publish". The run was already `--full`. The advice was unfollowable, the correct number never
 * reached disk, and four living documents ended up quoting it from console output.
 *
 * This file exists so that cannot come back. Section 0 runs the OLD predicate against the OLD
 * message and asserts they reproduce the failure — the standing gate in this repo is that a check
 * is shown FAILING on known-bad input before its green is believed, and a guard test that only
 * exercises the fixed code proves nothing about the bug it was written for.
 *
 *   node tests/test-shrink-guard.js
 */
'use strict';
const { shrinkDecision, FLAG } = require('./shrink_guard.js');

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n          ' + detail : '')); }
};

/* ---- 0. THE KNOWN-BAD INPUT ---------------------------------------------------------------------
 * The old guard, transcribed exactly as it stood, against the exact numbers of the real run. If
 * this section ever goes quiet it means the reproduction stopped reproducing, and then section 1
 * is asserting against nothing. */
console.log('\n0. the defect, reproduced (these two SHOULD be true — they are the bug)');
{
  const PREV = 1012, LIVE = 899, ARGV = ['--full', '--publish-shallow'];   // the real invocation
  const oldRefuses = (typeof PREV === 'number' && LIVE < PREV && !ARGV.includes('--publish-shallow'));
  const oldAdvice  = 'Re-run with --full to publish, or --publish-shallow if the shrink is intended.';

  /* The first --full run carried no flag at all, and THAT is the one that was refused. */
  const firstRunArgv = ['--full'];
  const oldRefusedTheFullRun = (LIVE < PREV && !firstRunArgv.includes('--publish-shallow'));
  ok(oldRefusedTheFullRun, 'old guard refused a --full run staging 899 against a published 1012');
  ok(/Re-run with --full/.test(oldAdvice) && firstRunArgv.includes('--full'),
     'old advice told a --full run to re-run with --full — the circle that cost the number');
  ok(oldRefuses === false,
     'old guard accepted a BARE --publish-shallow, recording no reason for the shrink');
}

/* ---- 1. THE FIX ---------------------------------------------------------------------------------- */
console.log('\n1. the advice now names a flag that works');
{
  const d = shrinkDecision(1012, 899, ['--full']);
  ok(d.write === false, 'a --full shrink is still refused without a declaration');
  const advice = d.advice.join(' ');
  ok(!/Re-run with --full/i.test(advice),
     'advice no longer tells a --full run to re-run with --full', advice);
  ok(/already --full/.test(advice),
     'advice states that a deeper run cannot help when the run was already --full', advice);
  ok(advice.includes(FLAG + '='),
     'advice names the flag that actually satisfies the guard, with its reason form', advice);
}
{
  const d = shrinkDecision(1012, 899, ['--depth=4']);
  ok(/re-run with --full first/i.test(d.advice.join(' ')),
     'a genuinely shallow run is still told to go deeper first — the original rule survives');
}

console.log('\n2. a shrink must carry its reason');
{
  const bare = shrinkDecision(1012, 899, ['--full', FLAG]);
  ok(bare.write === false, 'a BARE --publish-shallow is refused');
  ok(/no reason/.test(bare.why), 'the refusal says why', bare.why);

  const empty = shrinkDecision(1012, 899, ['--full', FLAG + '=']);
  ok(empty.write === false, 'an EMPTY reason is refused');
  const blank = shrinkDecision(1012, 899, ['--full', FLAG + '=   ']);
  ok(blank.write === false, 'a whitespace-only reason is refused');

  const good = shrinkDecision(1012, 899, ['--full', FLAG + '=four redundant tags retired']);
  ok(good.write === true, 'a declared shrink publishes');
  ok(good.declared === 'four redundant tags retired', 'the reason survives verbatim', good.declared);

  const quoted = shrinkDecision(1012, 899, ['--full', FLAG + '="four redundant tags retired"']);
  ok(quoted.declared === 'four redundant tags retired',
     'surrounding quotes are stripped, so a shell that keeps them does not corrupt the record',
     quoted.declared);
}

console.log('\n3. the cases that must NOT be treated as a shrink');
{
  ok(shrinkDecision(null, 899, []).write === true, 'no published artifact is a genuine first run');
  ok(shrinkDecision(undefined, 899, []).write === true, 'an unreadable artifact does not block a write');
  ok(shrinkDecision(899, 899, []).write === true, 'an unchanged count is not a shrink');
  ok(shrinkDecision(899, 1012, []).write === true, 'GROWTH is not a shrink');
  ok(shrinkDecision(899, 1012, []).declared === '', 'growth records no shrink reason');
  ok(shrinkDecision(899, 899, []).declared === '', 'an unchanged count records no shrink reason');
}

console.log('\n4. the declaration is not a way to publish anything at all');
{
  /* The flag must not become a blanket override. It only applies to the shrink decision; it does
   * not, for instance, turn a first run into a declared one and put a spurious reason on disk. */
  const first = shrinkDecision(null, 899, [FLAG + '=irrelevant']);
  ok(first.declared === '', 'the flag does not stamp a reason onto a run that never shrank');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
