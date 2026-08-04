/* showdown_path.js — WHERE THE OFFICIAL SIMULATOR IS. One answer, and it was twenty.
 *
 * THE HOLE THIS CLOSES. Six tests need a pokemon-showdown checkout, and every one of them skips
 * politely when it cannot find one:
 *
 *     test-wiring: set SHOWDOWN_PATH
 *
 * `tests/run-all.js` then reports a clean exit around the skip. Among the six is `test-wiring.js` —
 * the guard CLAUDE.md names as the direct answer to the 2026-07-28 failures, whose entire job is to
 * prove a capability RAN rather than that its code exists. It had been skipping while a checkout at
 * the pinned commit `20ad99f` sat one directory up the whole time, because the fallback path was
 * `/tmp/ps` and this project runs on Windows.
 *
 * That is this project's own central lesson pointed at its own toolchain. A skip is not a pass. A
 * guard that opts itself out is not a guard. Nothing was broken and nothing reported a failure —
 * which is the exact signature CLAUDE.md opens with.
 *
 * WHY A MODULE RATHER THAN A BETTER DEFAULT IN champions_sim. Twenty files each wrote
 * `if (!process.env.SHOWDOWN_PATH)` — FACTS ARE GLOBAL broken in its ordinary form, one fact with
 * twenty implementations. Fixing the default inside `champions_sim.showdownPath()` fixes the LOADER
 * and leaves all twenty GATES still asking the env var and still skipping. The gate and the loader
 * have to agree, so they have to be the same function.
 *
 * The side effect is deliberate: requiring this SETS `process.env.SHOWDOWN_PATH`, so a child process
 * spawned by a test inherits the resolved path without that test knowing this module exists.
 *
 * PRECEDENCE. An explicit env var always wins — a checkout kept somewhere else stays supported, and
 * this must never silently override what a person typed. Only then the sibling checkout, which is
 * where `git clone` beside this repo puts it and where it actually is.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* `sim/` rather than the directory itself: an empty folder, or a half-finished clone, would satisfy
 * an existsSync on the root and then fail deep inside a require with a confusing message. */
function looksLikeShowdown(p) {
  try { return !!p && fs.existsSync(path.join(p, 'sim')); } catch (e) { return false; }
}

const CANDIDATES = [
  path.join(__dirname, '..', '..', 'pokemon-showdown'),
  path.join(__dirname, '..', 'pokemon-showdown'),
  '/tmp/ps',
];

function resolve() {
  const env = process.env.SHOWDOWN_PATH;
  if (env) return looksLikeShowdown(env) ? env : env; /* honour it either way; the loader reports */
  for (const c of CANDIDATES) if (looksLikeShowdown(c)) return c;
  return null;
}

const RESOLVED = resolve();
/* Propagate to children. A test that spawns a worker gets the path without importing this. */
if (RESOLVED && !process.env.SHOWDOWN_PATH) process.env.SHOWDOWN_PATH = RESOLVED;

/* `hasSim()` is what a gate should ask. It is deliberately NOT "is the env var set" — that question
 * is what produced the skip, and answering it again anywhere would reopen the hole. */
function hasSim() { return looksLikeShowdown(RESOLVED); }

module.exports = { resolve, hasSim, looksLikeShowdown, CANDIDATES, RESOLVED };
