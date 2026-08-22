/* _live_release.js — POINT A RELEASE-READING INSTRUMENT AT THE LIVE TREE WITHOUT WRITING TO THE STORE.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_turn_order.js
 *
 * THE PROBLEM THIS SOLVES. `engine/game_differential.js` — and therefore every probe built on it —
 * reads a FROZEN release, never the live tree, and CUTS one at require time when `--release` is
 * absent. Cutting repoints `data/engine-release.json` under whatever else is measuring, which is the
 * exact hazard `engine_release.js`'s own comment describes: *"a test that exercises cut() against the
 * real store therefore REPOINTS the live pointer while another division may be measuring through
 * it"*. So an ENGINE agent who has just changed the simulator has no way to run its own probes
 * against the change: naming an existing release tests the OLD bytes, and not naming one writes to
 * the shared store.
 *
 * WHAT IT DOES. Redirects `cut` and `open` to a throwaway store under the OS temp directory, by
 * wrapping the two functions on the module object BEFORE any instrument requires it. Node's module
 * cache is what makes that work — the instrument's `require('./engine_release.js')` returns this same
 * object — so preloading with `-r` is load-bearing and not decoration. `data/releases/` and
 * `data/engine-release.json` are never touched, and `engine_release.js` prints the override on stderr
 * itself, so a run that used this CANNOT look like a run that did not.
 *
 * WHAT IT IS NOT. It is not a way to measure. A number produced this way is stamped with a release id
 * that exists only in somebody's temp directory and can never be reopened, so it is not reproducible
 * and must not be published. It is for GATES — "does my probe pass against the code I just wrote" —
 * and the moment a figure is wanted, cut a real release and name it.
 */
'use strict';
const path = require('path');
const os = require('os');

const SCRATCH = path.join(os.tmpdir(), 'abra-live-release-store');
const ER = require(path.join(__dirname, '..', 'engine', 'engine_release.js'));
const _cut = ER.cut, _open = ER.open;
ER.cut = (why, opts) => _cut(why, Object.assign({ store: SCRATCH }, opts || {}));
ER.open = (id, opts) => _open(id, Object.assign({ store: SCRATCH }, opts || {}));
console.error('  (tests/_live_release.js: releases redirected to ' + SCRATCH
  + ' — the live tree is what gets frozen, and data/releases is untouched)');
