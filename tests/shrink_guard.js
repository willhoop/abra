/* THE SHRINK GUARD, as a function you can test without playing 1,514 battles.
 *
 * `tests/test-interaction-matrix.js` refuses to let a run with FEWER live cases overwrite a
 * published artifact with more. That rule is right and it stays. It lived inline as six lines of
 * `if`, which meant the only way to exercise it was a full `--full` run — about two minutes of two
 * engines playing every case four times — so in practice nobody exercised it, and it shipped with
 * advice that could not work.
 *
 * Extracted here so the decision is a pure function of (previous count, this count, argv) and
 * `tests/test-shrink-guard.js` can drive every branch in milliseconds, including the branches that
 * only appear when the numbers move in an awkward direction. Same instinct as everything else in
 * this repo: a check nobody can afford to run is a check nobody runs.
 *
 * WHAT WENT WRONG, 2026-08-05, and why the shape changed:
 *
 *   Four redundant tags were retired. Live cases legitimately fell 1,012 -> 899. A `--full` run
 *   measured 899 of 899 agreeing — 100.0%, the best result the matrix has ever produced — and the
 *   guard refused to publish it, advising "Re-run with --full to publish". The run WAS `--full`.
 *   The guard tests `live < prevLive` and nothing else, so no amount of depth satisfies it; only
 *   `--publish-shallow` does, and that appeared last in the sentence as the unusual case.
 *
 *   The number was correct. It was read off the terminal into four living documents, where it then
 *   read as a figure attributed to an artifact that did not contain it.
 *
 * So two things are fixed and they are different fixes:
 *
 *   ADVICE THAT NAMES THE FLAG THAT ACTUALLY WORKS. If the run was already at `--full`, say so —
 *   a deeper run cannot help and telling someone to go deeper wastes their next two minutes.
 *
 *   A SHRINK CARRIES ITS REASON. `--publish-shallow` alone is REFUSED. It must be
 *   `--publish-shallow="four redundant tags retired"`, and the reason is written into the artifact
 *   as `shrink_declared`. This is the `RAW-STORE-OK` / `void: true` pattern: a judgement call is
 *   not suppressed, it is recorded where a consumer reading the artifact will find it. A bare flag
 *   that silences a gate without saying why is a flag that eventually silences it wrongly, and the
 *   next reader has no way to tell a retired tag from a mistake waved through.
 *
 * Deliberately NOT done: auto-detecting "the tag count changed, so the shrink must be fine". That
 * is the guard inferring its own excuse, which is how a gate stops being a gate.
 */
'use strict';

const FLAG = '--publish-shallow';

/* Returns { write, declared, why, advice }.
 *   write    — may this run overwrite the published artifact
 *   declared — the stated reason for an accepted shrink, or '' when nothing shrank
 *   why      — one sentence for the refusal line; '' when writing
 *   advice   — the lines to print under a refusal, already correct for how this run was invoked
 */
function shrinkDecision(prevLive, live, argv) {
  argv = argv || [];
  const ok = (declared) => ({ write: true, declared: declared || '', why: '', advice: [] });

  /* No published artifact, or one we could not read, is a genuine first run. The caller has
   * already said so on stderr; the guard cannot compare against a number it does not have. */
  if (typeof prevLive !== 'number' || !Number.isFinite(prevLive)) return ok('');
  if (!(live < prevLive)) return ok('');

  const raw = argv.find(a => a === FLAG || a.startsWith(FLAG + '='));
  const wasFull = argv.includes('--full');
  const depthAdvice = wasFull
    ? 'This run was already --full, so re-running deeper cannot change the count. The shrink is real.'
    : 'If this was a shallow run, re-run with --full first — that may restore the missing cases.';

  if (!raw) {
    return {
      write: false, declared: '', why:
        `this run staged ${live} live cases and the published artifact has ${prevLive}.`,
      advice: [
        'A shallower run must not replace a deeper one; the numbers above are still valid for this depth.',
        depthAdvice,
        `If the shrink is INTENDED, declare it with a reason:  ${FLAG}="why the count legitimately fell"`,
      ],
    };
  }

  const reason = raw.includes('=')
    ? raw.slice(raw.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '').trim()
    : '';

  if (!reason) {
    return {
      write: false, declared: '', why:
        `${FLAG} was given with no reason, and a shrink without a reason is not a declaration.`,
      advice: [
        `Live cases fell ${prevLive} -> ${live}. Something caused that and the artifact should say what.`,
        `Use:  ${FLAG}="four redundant tags retired"`,
        'The reason is written into the artifact as shrink_declared, so a later reader can tell a',
        'deliberate shrink from a shallow run that overwrote a deep one.',
      ],
    };
  }

  return ok(reason);
}

module.exports = { shrinkDecision, FLAG };
